// The office on the canvas (plan step 5.5, P-9): builds the active room from the store,
// caches its background (tiles + background props + the static wall content of
// `wallContent`, Phase 16) per room, theme and wall content, rebuilds the
// light layer when the lit lamps change, packs sprites and composed looks into the
// atlas, and draws every animation frame: background -> y-sorted props and characters
// -> light (multiply, then screen) -> name tags (P-13, office/tags.ts: one atlas
// entry per tag text, placed once per rebuild above the heads). Every sprite id of the layout and the themes exists
// (layout and theme tests); an unknown id is a bug, reported once with console.error.
// `?view=looks` draws the looks gallery (P-12, office/gallery.ts) instead of the room:
// floor tiles, every look standing with its tag, light off; `data-room` = `looks`.
import { SCENE_HEIGHT, SCENE_WIDTH } from '../../shared/constants.js';
import type { Character, Snapshot } from '../../shared/types.js';
import type { Store } from '../app/store.js';
import { createAtlas } from '../render/atlas.js';
import { CLEAR_COLOUR } from '../render/canvas.js';
import { lightKey, lightRaster, type LitLamp } from '../render/light.js';
import { startLoop } from '../render/loop.js';
import { FrameStats } from '../render/stats.js';
import { composeCharacter, type IdleFrame } from '../sprites/characters/compose.js';
import { composeIntern } from '../sprites/interns/index.js';
import { rasterizeSprite, spriteById } from '../sprites/registry.js';
import { galleryEntries } from './gallery.js';
import { idleFrame, IDLE_FRAMES } from './idle.js';
import { COLS, LAMP_POINTS, ROWS, TILE, tileKind, type TileKind } from './layout.js';
import { lookKey, type Look } from './look.js';
import {
  backgroundProps,
  buildScene,
  selectProject,
  wallContent,
  wallKey,
  wallTextRaster,
  type Scene,
  type WallContent,
  type WallText,
} from './scene.js';
import { layoutTags, inkTop, tagRaster, tagText, truncateTag, type PlacedTextTag, type TagSubject } from './tags.js';
import { NERD, type Theme } from './theme.js';

export interface OfficeOptions {
  /** Hold every character on idle frame 0 (default: the `prefers-reduced-motion` media query). */
  reducedMotion?: boolean;
  /** `looks`: the looks gallery (P-12) instead of the room (default: `?view=looks` in the URL). */
  view?: 'office' | 'looks';
}

/** The view the URL asks for: `?view=looks` shows the looks gallery. */
function viewFromUrl(): 'office' | 'looks' {
  return new URLSearchParams(location.search).get('view') === 'looks' ? 'looks' : 'office';
}

/** Tile kinds whose sprite has transparent pixels: the theme's wall tile is drawn under them. */
const OVER_WALL: ReadonlySet<TileKind> = new Set<TileKind>(['slope-l', 'slope-r', 'skirting']);

/** Atlas id of one idle frame of a look. */
function lookSprite(look: Look, frame: number): string {
  return `look:${lookKey(look)}:${String(frame)}`;
}

/** Atlas id of the tag box showing `text`. */
function tagSprite(text: string): string {
  return `tag:${text}`;
}

function context(canvas: HTMLCanvasElement): CanvasRenderingContext2D {
  const ctx = canvas.getContext('2d');
  if (ctx === null) throw new Error('office: no 2d context');
  ctx.imageSmoothingEnabled = false;
  return ctx;
}

function offscreen(w = SCENE_WIDTH, h = SCENE_HEIGHT): { canvas: HTMLCanvasElement; ctx: CanvasRenderingContext2D } {
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  return { canvas, ctx: context(canvas) };
}

/** Draws the office of the store's active project into `canvas`; returns a disposer. */
export function mountOffice(canvas: HTMLCanvasElement, store: Store, opts: OfficeOptions = {}): () => void {
  const reduced = opts.reducedMotion ?? matchMedia('(prefers-reduced-motion: reduce)').matches;
  const gallery = (opts.view ?? viewFromUrl()) === 'looks';
  const ctx = context(canvas);
  const atlas = createAtlas();
  const missing = new Set<string>();
  const backgrounds = new Map<string, HTMLCanvasElement>();
  const seatsByProject = new Map<string, Map<string, string>>();
  const light = { key: '', multiply: offscreen(), screen: offscreen() };

  /** Per look key: frame width and the first opaque row of idle frame 0 (head top). */
  const heads = new Map<string, { w: number; top: number }>();
  let scene: Scene | null = null;
  let tags: PlacedTextTag[] = [];
  let background: HTMLCanvasElement | null = null;
  let lastSnapshot: Snapshot | null = null;
  let lastActive: string | null | undefined;
  let timeMs = 0;
  let drawnShown = -1;

  /**
   * Packs sprite `id` on first use (recoloured by `theme` if it recolours that id) and
   * returns its atlas id; null (and one console error) for an id no family has.
   */
  const sprite = (id: string, theme?: Theme): string | null => {
    const recolour = theme?.recolour[id];
    const atlasId = recolour === undefined ? id : `${id}@${theme?.name ?? ''}`;
    if (atlas.has(atlasId)) return atlasId;
    const def = spriteById(id);
    if (def === undefined) {
      if (!missing.has(id)) {
        missing.add(id);
        console.error(`office: unknown sprite "${id}"`);
      }
      return null;
    }
    atlas.add(atlasId, rasterizeSprite(def, recolour));
    return atlasId;
  };

  const tile = (target: CanvasRenderingContext2D, id: string, x: number, y: number, theme?: Theme): void => {
    const atlasId = sprite(id, theme);
    if (atlasId !== null) atlas.draw(target, atlasId, x, y);
  };

  /** Draws a wall text (paper box + ink), packing it once per text and box. */
  const wallLabel = (target: CanvasRenderingContext2D, t: WallText): void => {
    const id = `wall:${t.text}:${String(t.box.w)}:${String(t.x - t.box.x)}`;
    if (!atlas.has(id)) atlas.add(id, wallTextRaster(t));
    atlas.draw(target, id, t.box.x, t.box.y);
  };

  const buildBackground = (projectId: string, theme: Theme, wall: WallContent | null): HTMLCanvasElement => {
    const key = `${projectId}|${theme.name}|${wallKey(wall)}`;
    const cached = backgrounds.get(key);
    if (cached !== undefined) return cached;
    const bg = offscreen();
    bg.ctx.fillStyle = CLEAR_COLOUR;
    bg.ctx.fillRect(0, 0, SCENE_WIDTH, SCENE_HEIGHT);
    for (let row = 0; row < ROWS; row++) {
      for (let col = 0; col < COLS; col++) {
        const kind = tileKind(col, row);
        if (OVER_WALL.has(kind)) tile(bg.ctx, theme.tiles.wall, col * TILE, row * TILE, theme);
        tile(bg.ctx, theme.tiles[kind], col * TILE, row * TILE, theme);
      }
    }
    for (const item of backgroundProps(theme)) {
      if (item.sprite !== undefined) tile(bg.ctx, item.sprite, item.x, item.y, theme);
    }
    // OFFICE-7 static content (Phase 16): filled done frames over the layout's empty ones, wall texts.
    for (const f of wall?.frames ?? []) {
      if (f.sprite === 'done-frame-empty') continue;
      tile(bg.ctx, f.sprite, f.x, f.y, theme);
      if (f.label !== undefined) wallLabel(bg.ctx, f.label);
    }
    for (const t of wall?.texts ?? []) wallLabel(bg.ctx, t);
    backgrounds.set(key, bg.canvas);
    return bg.canvas;
  };

  const rebuildLight = (s: Scene): void => {
    const lamps: LitLamp[] = [...s.lamps].flatMap((id) => {
      const at = LAMP_POINTS.get(id);
      return at === undefined ? [] : [{ id, x: at.x, y: at.y }];
    });
    const key = lightKey(lamps, s.theme);
    if (key === light.key) return;
    light.key = key;
    const layers = lightRaster(lamps, s.theme);
    for (const [target, r] of [
      [light.multiply.ctx, layers.multiply],
      [light.screen.ctx, layers.screen],
    ] as const) {
      target.clearRect(0, 0, SCENE_WIDTH, SCENE_HEIGHT);
      target.putImageData(new ImageData(new Uint8ClampedArray(r.data), r.w, r.h), 0, 0);
    }
  };

  const registerLooks = (s: Scene): void => {
    for (const item of s.items) {
      if (item.kind !== 'character' || item.look === undefined) continue;
      const look = item.look;
      for (let f = 0; f < IDLE_FRAMES; f++) {
        const id = lookSprite(look, f);
        if (atlas.has(id)) continue;
        const frame = f as IdleFrame;
        const r = look.intern ? composeIntern(look, frame) : composeCharacter(look, frame);
        atlas.add(id, r);
        if (f === 0) heads.set(lookKey(look), { w: r.w, top: inkTop(r) });
      }
    }
  };

  /** Places the tags of `s`'s characters (`textOf(id)`) and packs each tag text once. */
  const placeSceneTags = (s: Scene, textOf: (id: string) => string): void => {
    const subjects: TagSubject[] = [];
    for (const item of s.items) {
      if (item.kind !== 'character' || item.look === undefined) continue;
      const head = heads.get(lookKey(item.look));
      if (head === undefined) continue;
      subjects.push({ id: item.id, text: textOf(item.id), x: item.x, y: item.y, w: head.w, sortY: item.sortY, headTop: head.top });
    }
    tags = layoutTags(subjects);
    for (const t of tags) {
      const id = tagSprite(t.text);
      if (!atlas.has(id)) atlas.add(id, tagRaster(t.text));
    }
  };

  /** The looks gallery (P-12): every look standing on the plain floor, light off. */
  const rebuildGallery = (snapshot: Snapshot): void => {
    const items = galleryEntries(snapshot.characters);
    const next: Scene = { project: null, theme: NERD, seats: new Map(), overflow: [], items, lamps: new Set() };
    registerLooks(next);
    const tagOf = new Map(items.map((e) => [e.id, e.tag]));
    placeSceneTags(next, (id) => tagOf.get(id) ?? '');
    if (background === null) {
      const bg = offscreen();
      for (let row = 0; row < ROWS; row++) {
        for (let col = 0; col < COLS; col++) tile(bg.ctx, NERD.tiles.floor, col * TILE, row * TILE, NERD);
      }
      background = bg.canvas;
    }
    scene = next;
    canvas.dataset['room'] = 'looks';
    canvas.dataset['overflow'] = '0';
    drawnShown = -1;
  };

  const rebuild = (snapshot: Snapshot, activeProjectId: string | null): void => {
    if (gallery) {
      rebuildGallery(snapshot);
      return;
    }
    const target = selectProject(snapshot, activeProjectId);
    const next = buildScene(snapshot, activeProjectId, seatsByProject.get(target?.id ?? ''));
    if (next.project !== null) seatsByProject.set(next.project.id, next.seats);
    registerLooks(next);
    const byId = new Map<string, Character>(snapshot.characters.map((c) => [c.id, c]));
    placeSceneTags(next, (id) => {
      const c = byId.get(id);
      return c === undefined ? '' : truncateTag(tagText(c));
    });
    background = next.project === null ? null : buildBackground(next.project.id, next.theme, wallContent(next.project));
    rebuildLight(next);
    scene = next;
    canvas.dataset['room'] = next.project?.name ?? '';
    canvas.dataset['overflow'] = String(next.overflow.length);
    drawnShown = -1;
  };

  const onState = (): void => {
    const { snapshot, ui } = store.getState();
    if (snapshot === null || (snapshot === lastSnapshot && ui.activeProjectId === lastActive)) return;
    lastSnapshot = snapshot;
    lastActive = ui.activeProjectId;
    rebuild(snapshot, ui.activeProjectId);
  };

  const draw = (): void => {
    ctx.globalCompositeOperation = 'source-over';
    if (scene === null) return;
    if (background === null) {
      ctx.fillStyle = CLEAR_COLOUR;
      ctx.fillRect(0, 0, SCENE_WIDTH, SCENE_HEIGHT);
    } else {
      ctx.drawImage(background, 0, 0);
    }
    let drawn = 0;
    for (const item of scene.items) {
      if (item.kind === 'character' && item.look !== undefined) {
        if (atlas.draw(ctx, lookSprite(item.look, idleFrame(timeMs, item.id, reduced)), item.x, item.y)) drawn++;
      } else if (item.sprite !== undefined) {
        tile(ctx, item.sprite, item.x, item.y, scene.theme);
      }
    }
    if (!gallery) {
      ctx.globalCompositeOperation = 'multiply';
      ctx.drawImage(light.multiply.canvas, 0, 0);
      ctx.globalCompositeOperation = 'screen';
      ctx.drawImage(light.screen.canvas, 0, 0);
      ctx.globalCompositeOperation = 'source-over';
    }
    for (const t of tags) atlas.draw(ctx, tagSprite(t.text), t.x, t.y);
    if (drawn !== drawnShown) {
      drawnShown = drawn;
      canvas.dataset['drawn'] = String(drawn);
    }
  };

  const unsubscribe = store.subscribe(onState);
  onState();
  const stopLoop = startLoop({
    update: (dtMs) => {
      timeMs += dtMs;
    },
    draw,
    stats: new FrameStats(),
    onSecond: (stats) => {
      canvas.dataset['frameMs'] = stats.p95().toFixed(1);
    },
  });

  return () => {
    stopLoop();
    unsubscribe();
  };
}
