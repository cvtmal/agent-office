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
// #5 office-life (office/life/README.md): `update` ticks the server clock and walks the
// actors; `draw` draws a per-frame copy of the character items at their actor frames
// (pose or idle frame) with their overlays, then above the light the tags (a fixed offset
// from the rest layout, PL6), context meters, sweat, speech bubbles and confetti.
// `data-moving` / `data-bubbles` expose walking and visible bubbles to e2e.
import { SCENE_HEIGHT, SCENE_WIDTH, type ActivityKind } from '../../shared/constants.js';
import type { Character, Snapshot } from '../../shared/types.js';
import type { Store } from '../app/store.js';
import { createAtlas } from '../render/atlas.js';
import { CLEAR_COLOUR } from '../render/canvas.js';
import { lightKey, lightRaster, type LitLamp } from '../render/light.js';
import { startLoop } from '../render/loop.js';
import { colour, rampMap, type RampName } from '../render/palette.js';
import type { Raster } from '../render/raster.js';
import { FrameStats } from '../render/stats.js';
import { verdictHex } from '../render/verdict-colour.js';
import { composeCharacter, POSE_FRAMES, type IdleFrame, type PoseFrame } from '../sprites/characters/compose.js';
import { SKINS } from '../sprites/characters/space.js';
import { composeIntern } from '../sprites/interns/index.js';
import { rasterizeSprite, spriteById } from '../sprites/registry.js';
import { ART_COLOURS, LIFE_IDS } from './art-ids.js';
import { characterBoxes, LAYOUT_EVENT } from './boxes.js'; // #6
import { galleryEntries } from './gallery.js';
import { idleFrame, IDLE_FRAMES } from './idle.js';
import {
  COLS,
  FRAME_W,
  INTERN_W,
  LAMP_POINTS,
  ROWS,
  TILE,
  isSeated,
  spot as spotOf,
  tileKind,
  type Spot,
  type TileKind,
} from './layout.js';
import { actorFrame, planTargets, stepActors, syncActors, type Actor } from './life/actors.js';
import { createBubbles, newActivities } from './life/bubbles.js';
import { cheererFor, confetti, confettiAt, doneWallArea, newOutcomes, type Particle } from './life/celebrate.js';
import { createServerClock } from './life/clock.js';
import { CHEER_MS, CONFETTI_MS, LAYOUT_EVERY_MS, SWEAT_FRAME_MS } from './life/constants.js';
import {
  BUBBLE_H,
  bubbleRaster,
  meterRect,
  placeBubble,
  placeBubbles,
  sweatAt,
  type BubbleBox,
  type BubblePlace,
  type TagBox,
} from './life/draw.js';
import { buildGrid } from './life/grid.js';
import { meterFill, showMeter, sweats } from './life/meter.js';
import { overlaysFor } from './life/overlays.js';
import { lookKey, type Look } from './look.js';
import {
  backgroundProps,
  buildScene,
  compareItems,
  selectProject,
  tidied,
  wallContent,
  wallKey,
  wallTextRaster,
  type DrawItem,
  type Scene,
  type WallContent,
  type WallText,
} from './scene.js';
import {
  layoutTags,
  inkTop,
  tagRaster,
  tagText,
  tagWidth,
  truncateTag,
  TAG_FILL,
  TAG_GAP,
  TAG_HEIGHT,
  TAG_OUTLINE,
  type PlacedTextTag,
  type TagSubject,
} from './tags.js';
import { NERD, type Theme } from './theme.js';

export interface OfficeOptions {
  /** Hold every character on idle frame 0 (default: the store's live `ui.reducedMotion`, app/motion.ts; #6). */
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

/** Atlas id of one frame of a look: an idle frame 0-3 or a pose (`look:<key>:<pose>`, #5). */
function lookSprite(look: Look, frame: number | PoseFrame): string {
  return `look:${lookKey(look)}:${String(frame)}`;
}

// #5 office-life
/** Life sprites drawn in the reference skin (skinA): packed once per skin ramp. */
const SKIN_TONED: readonly string[] = [...LIFE_IDS.hands, LIFE_IDS.hand];

/** The skin ramp of a look (compose.ts `tonesFor` wraps the index the same way). */
function skinOf(look: Look): RampName {
  return SKINS[((look.skin % SKINS.length) + SKINS.length) % SKINS.length] ?? 'skinA';
}

/** Most bubble boxes kept as canvases (oldest dropped first). */
const BUBBLE_CACHE = 64;
// end #5 office-life

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

/** A raster as a canvas of its size (#5: bubble boxes). */
function rasterCanvas(r: Raster): HTMLCanvasElement {
  const { canvas, ctx } = offscreen(r.w, r.h);
  ctx.putImageData(new ImageData(new Uint8ClampedArray(r.data), r.w, r.h), 0, 0);
  return canvas;
}

/** Draws the office of the store's active project into `canvas`; returns a disposer. */
export function mountOffice(canvas: HTMLCanvasElement, store: Store, opts: OfficeOptions = {}): () => void {
  // #6 inspector-ui hooks
  /** Reduced motion, read every frame so a media-query change applies live (R7). */
  const reducedNow = (): boolean => opts.reducedMotion ?? store.getState().ui.reducedMotion;
  /** `ui.hideEnded` of the last rebuild (part of the rebuild key). */
  let lastHideEnded = false;
  /**
   * The character boxes changed: the next `draw` dispatches `LAYOUT_EVENT` (P-5), so
   * listeners mounted after `mountOffice` never miss the first layout.
   * #5: set layoutDirty when characters move.
   */
  let layoutDirty = false;
  const emitLayout = (): void => {
    if (!layoutDirty || scene === null) return;
    layoutDirty = false;
    canvas.dispatchEvent(new CustomEvent(LAYOUT_EVENT, { detail: gallery ? [] : characterBoxes(frameItems) })); // #5: frameItems
  };
  // end #6 inspector-ui hooks
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

  // #5 office-life
  const grid = buildGrid();
  /** Estimated server time (R2); ticks only while not paused. */
  const clock = createServerClock();
  const bubbles = createBubbles();
  /** Actors of the active room by character id (R4). */
  let actors = new Map<string, Actor>();
  /** Characters of the active room at the last rebuild (meters, sweat, tidy check). */
  let lifeChars = new Map<string, Character>();
  /** Seat of each parent's first intern by parent id: where a delegate folder travels to (R3). */
  let internSeats = new Map<string, Spot>();
  /** Per character: its tag text and the tag's offset from the character's rest frame (PL6). */
  let tagOffsets = new Map<string, { text: string; dx: number; dy: number }>();
  let celebrations: Particle[][] = [];
  let prevSnapshotForLife: Snapshot | null = null;
  let firstLife = true;
  let lifeProject: string | null = null;
  let lastLayoutMs = Number.NEGATIVE_INFINITY;
  let lastLifeCheckMs = 0;
  let wasMoving = false;
  let movedSinceDraw = false;
  /** This frame's draw list: characters at their actor frames, sorted; also the layout boxes. */
  let frameItems: DrawItem[] = [];
  /** This frame's pose sprite per character id (absent: the idle frame). */
  const frameSprites = new Map<string, string>();
  const bubbleCanvases = new Map<string, HTMLCanvasElement>();
  let movingShown = '';
  let bubblesShown = -1;
  // end #5 office-life

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
    if (wall?.plate != null) wallLabel(bg.ctx, wall.plate); // #5 caption plate (R8)
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
      if (!gallery) registerLife(look); // #5
    }
  };

  // #5 office-life
  /** Packs the pose frames of `look` and the life sprites in its skin (typing hands, raised hand). */
  const registerLife = (look: Look): void => {
    for (const pose of POSE_FRAMES) {
      const id = lookSprite(look, pose);
      if (!atlas.has(id)) atlas.add(id, look.intern ? composeIntern(look, pose) : composeCharacter(look, pose));
    }
    const skin = skinOf(look);
    for (const id of SKIN_TONED) {
      const def = spriteById(id);
      const atlasId = `${id}@${skin}`;
      if (def !== undefined && !atlas.has(atlasId)) atlas.add(atlasId, rasterizeSprite(def, rampMap('skinA', skin)));
    }
  };

  /** Atlas id of a life overlay sprite as worn by `look` (skin-toned sprites per skin ramp). */
  const lifeSprite = (id: string, look: Look): string | null =>
    SKIN_TONED.includes(id) ? `${id}@${skinOf(look)}` : sprite(id);

  /** `s` with every character item at its actor's rest frame (tags are laid out there, PL6). */
  const restScene = (s: Scene): Scene => ({
    ...s,
    items: s.items.map((item) => {
      const a = item.kind === 'character' ? actors.get(item.id) : undefined;
      if (a === undefined) return item;
      const f = actorFrame({ ...a, x: a.target.x, y: a.target.y, path: [] }, 0, true);
      return {
        ...item,
        x: Math.round(f.x),
        y: Math.round(f.y),
        sortY: f.sortY,
      };
    }),
  });

  /** Targets of the room's characters (R3) and the actors walking to them (R4). */
  const planLife = (snapshot: Snapshot, s: Scene, first: boolean): void => {
    const chars = [...lifeChars.values()];
    const seatOf = (id: string): Spot | undefined => {
      const name = s.seats.get(id);
      return name === undefined ? undefined : spotOf(name);
    };
    const targets = planTargets(chars, seatOf, snapshot.activities, clock.now());
    const interns = new Set(chars.filter((c) => c.kind === 'agent').map((c) => c.id));
    actors = syncActors(actors, targets, interns, first, grid);
    // Reduced motion (R5): jump right away, so `data-moving` is true for one frame at most.
    if (reducedNow() && !store.getState().ui.paused && stepActors(actors, 0, true)) {
      movedSinceDraw = true;
      layoutDirty = true;
    }
  };

  /** Life part of a rebuild: actors, new bubbles, new outcomes (confetti + cheer). */
  const rebuildLife = (snapshot: Snapshot, s: Scene): void => {
    const projectId = s.project?.id ?? null;
    const first = firstLife || projectId !== lifeProject;
    lifeProject = projectId;
    lifeChars = new Map(snapshot.characters.filter((c) => c.projectId === projectId).map((c) => [c.id, c]));
    internSeats = new Map();
    for (const c of [...lifeChars.values()].sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0))) {
      const seat = s.seats.get(c.id);
      if (c.kind === 'agent' && c.parentId !== null && seat !== undefined && !internSeats.has(c.parentId)) {
        internSeats.set(c.parentId, spotOf(seat));
      }
    }
    planLife(snapshot, s, first);
    for (const a of newActivities(prevSnapshotForLife, snapshot)) {
      if (lifeChars.has(a.characterId)) bubbles.push(a, timeMs);
    }
    for (const o of newOutcomes(prevSnapshotForLife, snapshot)) {
      if (o.projectId !== projectId) continue;
      celebrations.push(confetti(`${o.projectId}:${String(o.nn)}:${o.slug}`, doneWallArea(), timeMs));
      const cheerer = actors.get(cheererFor(snapshot, o.projectId, o.slug) ?? '');
      if (cheerer !== undefined) cheerer.cheerUntil = timeMs + CHEER_MS;
    }
    prevSnapshotForLife = snapshot;
    firstLife = false;
  };

  /** Tag offsets from the rest frames of `rest` (after `placeSceneTags(rest, …)`). */
  const storeTagOffsets = (rest: Scene): void => {
    const at = new Map(rest.items.map((i) => [i.id, i]));
    tagOffsets = new Map();
    for (const t of tags) {
      const item = at.get(t.id);
      if (item !== undefined)
        tagOffsets.set(t.id, {
          text: t.text,
          dx: t.x - item.x,
          dy: t.y - item.y,
        });
    }
  };

  /** Once a second: a tidy-due desk rebuilds the room (R2); otherwise re-plan (idle -> couch). */
  const checkLife = (): void => {
    const s = scene;
    if (s === null || s.project === null || lastSnapshot === null) return;
    const now = clock.now();
    if ([...lifeChars.values()].some((c) => s.seats.has(c.id) && tidied(c, now))) {
      rebuild(lastSnapshot, lastActive ?? null);
      return;
    }
    planLife(lastSnapshot, s, false);
  };

  /** One un-paused update step (R10: `layoutDirty` while walking, and once more when all stop). */
  const stepLife = (dtMs: number): void => {
    if (gallery) return;
    clock.tick(dtMs);
    const moved = stepActors(actors, dtMs, reducedNow());
    if (moved) movedSinceDraw = true;
    if ((moved && timeMs - lastLayoutMs >= LAYOUT_EVERY_MS) || (wasMoving && !moved)) {
      layoutDirty = true;
      lastLayoutMs = timeMs;
    }
    wasMoving = moved;
    bubbles.step(timeMs);
    if (celebrations.length > 0) celebrations = celebrations.filter((p) => timeMs - (p[0]?.startMs ?? 0) < CONFETTI_MS);
    if (timeMs - lastLifeCheckMs >= 1000) {
      lastLifeCheckMs = timeMs;
      checkLife();
    }
  };

  /** The per-frame draw list: scene items, characters at their actor frames, gone ones left out. */
  const lifeFrameItems = (s: Scene, reduced: boolean): DrawItem[] => {
    frameSprites.clear();
    const out: DrawItem[] = [];
    for (const item of s.items) {
      const a = item.kind === 'character' ? actors.get(item.id) : undefined;
      if (a === undefined || item.look === undefined) {
        out.push(item);
        continue;
      }
      if (a.gone) continue;
      const f = actorFrame(a, timeMs, reduced);
      if (f.frame !== null) frameSprites.set(item.id, lookSprite(item.look, f.frame as PoseFrame));
      const seated = a.path.length === 0 && isSeated(spotOf(a.target.spot).kind);
      out.push({
        ...item,
        x: Math.round(f.x),
        y: Math.round(f.y),
        sortY: f.sortY,
        seated,
      });
    }
    return out.sort(compareItems);
  };

  /** The overlays of a drawn character (R3), drawn after all items (on its desk and monitor). */
  const drawOverlays = (item: DrawItem, reduced: boolean): void => {
    const a = actors.get(item.id);
    if (a === undefined || item.look === undefined) return;
    for (const o of overlaysFor(a, timeMs, reduced, (id) => internSeats.get(id))) {
      const id = lifeSprite(o.sprite, item.look);
      if (id !== null) atlas.draw(ctx, id, o.x, o.y);
    }
  };

  /** A bubble box as a canvas, cached by kind and text. */
  const bubbleCanvas = (kind: ActivityKind, text: string): HTMLCanvasElement => {
    const key = `${kind}|${text}`;
    let c = bubbleCanvases.get(key);
    if (c === undefined) {
      c = rasterCanvas(bubbleRaster(kind, text));
      bubbleCanvases.set(key, c);
      if (bubbleCanvases.size > BUBBLE_CACHE) {
        const oldest = bubbleCanvases.keys().next().value;
        if (oldest !== undefined) bubbleCanvases.delete(oldest);
      }
    }
    return c;
  };

  /** A bubble above its tag (R6), its tail pointing down at the head. */
  const drawBubble = (box: HTMLCanvasElement, p: BubblePlace): void => {
    ctx.drawImage(box, p.x, p.y);
    const bottom = p.y + BUBBLE_H;
    ctx.fillStyle = colour(TAG_FILL);
    ctx.fillRect(p.tailX + 1, bottom - 1, 1, 2);
    ctx.fillStyle = colour(TAG_OUTLINE);
    ctx.fillRect(p.tailX, bottom, 1, 1);
    ctx.fillRect(p.tailX + 2, bottom, 1, 1);
    ctx.fillRect(p.tailX + 1, bottom + 1, 1, 1);
  };

  /** Above the light: tags, meters and sweat, then bubbles, then confetti (R5-R8). */
  const drawLifeTop = (reduced: boolean): void => {
    const shown: (BubbleBox & { box: HTMLCanvasElement })[] = [];
    const tags: TagBox[] = [];
    const visible = new Map(bubbles.visible(timeMs).map((b) => [b.characterId, b]));
    for (const item of frameItems) {
      if (item.kind !== 'character' || item.look === undefined) continue;
      const intern = item.intern === true;
      const frame = { x: item.x, w: intern ? INTERN_W : FRAME_W };
      const headY = item.y + (heads.get(lookKey(item.look))?.top ?? 0);
      const tag = tagOffsets.get(item.id);
      const tagTop = tag === undefined ? headY - TAG_GAP - TAG_HEIGHT : item.y + tag.dy;
      if (tag !== undefined) {
        atlas.draw(ctx, tagSprite(tag.text), item.x + tag.dx, tagTop);
        tags.push({ id: item.id, rect: { x: item.x + tag.dx, y: tagTop, w: tagWidth(tag.text), h: TAG_HEIGHT } });
      }
      const c = lifeChars.get(item.id);
      if (c !== undefined && showMeter(c)) {
        const r = meterRect(frame, tagTop + TAG_HEIGHT, headY, intern);
        ctx.fillStyle = colour(ART_COLOURS.meterTrack);
        ctx.fillRect(r.x, r.y, r.w, r.h);
        const fill = meterFill(c);
        ctx.fillStyle = verdictHex(c.verdict);
        if (fill > 0) ctx.fillRect(r.x, r.y, Math.max(1, Math.round(r.w * fill)), r.h);
      }
      if (c !== undefined && sweats(c)) {
        const at = sweatAt(frame, headY, intern);
        const n = reduced ? 0 : Math.floor(timeMs / SWEAT_FRAME_MS) % LIFE_IDS.sweat.length;
        tile(ctx, LIFE_IDS.sweat[n] ?? LIFE_IDS.sweat[0], at.x, at.y);
      }
      const b = visible.get(item.id);
      if (b !== undefined) {
        const box = bubbleCanvas(b.kind, b.text);
        const w = box.width;
        shown.push({ id: item.id, w, box, place: placeBubble(w, frame.x + frame.w / 2, tagTop) });
      }
    }
    const places = placeBubbles(shown, tags);
    for (const s of shown) drawBubble(s.box, places.get(s.id) ?? s.place);
    if (!reduced) {
      for (const particles of celebrations) {
        for (const p of confettiAt(particles, timeMs)) {
          ctx.fillStyle = colour(p.colour);
          ctx.fillRect(p.x, p.y, 2, 2);
        }
      }
    }
    if (shown.length !== bubblesShown) {
      bubblesShown = shown.length;
      canvas.dataset['bubbles'] = String(shown.length);
    }
  };

  /** `data-moving`: someone walked since the last draw, or is walking and not paused. */
  const showMoving = (): void => {
    const walking = !store.getState().ui.paused && [...actors.values()].some((a) => a.path.length > 0);
    const moving = String(movedSinceDraw || walking);
    movedSinceDraw = false;
    if (moving !== movingShown) {
      movingShown = moving;
      canvas.dataset['moving'] = moving;
    }
  };
  // end #5 office-life

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
    layoutDirty = true; // #6
  };

  const rebuild = (snapshot: Snapshot, activeProjectId: string | null): void => {
    if (gallery) {
      rebuildGallery(snapshot);
      return;
    }
    const target = selectProject(snapshot, activeProjectId);
    clock.observe(snapshot); // #5
    const opts = { hideEnded: lastHideEnded, nowMs: clock.now() }; // #6 hideEnded, #5 nowMs
    const next = buildScene(snapshot, activeProjectId, seatsByProject.get(target?.id ?? ''), opts); // #6
    if (next.project !== null) seatsByProject.set(next.project.id, next.seats);
    registerLooks(next);
    rebuildLife(snapshot, next); // #5
    const rest = restScene(next); // #5: tags are laid out at the rest frames
    const byId = new Map<string, Character>(snapshot.characters.map((c) => [c.id, c]));
    placeSceneTags(rest, (id) => {
      const c = byId.get(id);
      return c === undefined ? '' : truncateTag(tagText(c));
    });
    storeTagOffsets(rest); // #5
    background = next.project === null ? null : buildBackground(next.project.id, next.theme, wallContent(next.project));
    rebuildLight(next);
    scene = next;
    canvas.dataset['room'] = next.project?.name ?? '';
    canvas.dataset['overflow'] = String(next.overflow.length);
    drawnShown = -1;
    layoutDirty = true; // #6
  };

  const onState = (): void => {
    const { snapshot, ui } = store.getState();
    if (
      snapshot === null ||
      (snapshot === lastSnapshot && ui.activeProjectId === lastActive && ui.hideEnded === lastHideEnded) // #6
    )
      return;
    lastSnapshot = snapshot;
    lastActive = ui.activeProjectId;
    lastHideEnded = ui.hideEnded; // #6
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
    const reduced = reducedNow(); // #5
    frameItems = gallery ? scene.items : lifeFrameItems(scene, reduced); // #5
    for (const item of frameItems) {
      if (item.kind === 'character' && item.look !== undefined) {
        const look = frameSprites.get(item.id) ?? lookSprite(item.look, idleFrame(timeMs, item.id, reducedNow())); // #5 pose
        if (atlas.draw(ctx, look, item.x, item.y)) drawn++; // #6
      } else if (item.sprite !== undefined) {
        tile(ctx, item.sprite, item.x, item.y, scene.theme);
      }
    }
    // #5 overlays after every item: the desk, keyboard and monitor sort in front of their
    // sitter, so drawn right after it the papers, hands, terminal and globe were hidden (#7).
    if (!gallery) for (const item of frameItems) if (item.kind === 'character') drawOverlays(item, reduced);
    if (!gallery) {
      ctx.globalCompositeOperation = 'multiply';
      ctx.drawImage(light.multiply.canvas, 0, 0);
      ctx.globalCompositeOperation = 'screen';
      ctx.drawImage(light.screen.canvas, 0, 0);
      ctx.globalCompositeOperation = 'source-over';
    }
    if (gallery) {
      for (const t of tags) atlas.draw(ctx, tagSprite(t.text), t.x, t.y);
    } else {
      drawLifeTop(reduced); // #5: tags follow their characters
      showMoving(); // #5
    }
    if (drawn !== drawnShown) {
      drawnShown = drawn;
      canvas.dataset['drawn'] = String(drawn);
    }
    emitLayout(); // #6
  };

  const unsubscribe = store.subscribe(onState);
  onState();
  const stopLoop = startLoop({
    update: (dtMs) => {
      if (!store.getState().ui.paused) timeMs += dtMs; // #6
      if (!store.getState().ui.paused) stepLife(dtMs); // #5 office-life
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
