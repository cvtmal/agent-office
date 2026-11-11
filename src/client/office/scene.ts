// One room as data (research §Selected Approach 1, P-8, P-9): which project, its theme,
// who sits where, the y-sorted dynamic draw list and the lit lamps. The canvas code
// (`mount.ts`) only draws what this returns. DOM-free.
import type { Character, Project, Snapshot } from '../../shared/types.js';
import { CAP_HEIGHT, measure, textRaster } from '../render/font.js';
import { rgba } from '../render/palette.js';
import { blank, blit, type Raster } from '../render/raster.js';
import { ART_COLOURS } from './art-ids.js';
import { PROPS, SPOTS, WHITEBOARD_TEXT, characterFrame, isSeated, spot as spotByName, type Prop } from './layout.js';
import { doneWallArea } from './life/celebrate.js';
import { TIDY_AFTER_MS } from './life/constants.js';
import { lookFor, type Look } from './look.js';
import { assignSeats } from './seats.js';
import { themeFor, themedSprite, type Theme } from './theme.js';

/** One thing of the y-sorted dynamic layer. `(x, y)` is the sprite's (or frame's) top-left. */
export interface DrawItem {
  kind: 'character' | 'prop';
  /** Character id, or prop slot. */
  id: string;
  /** Prop sprite id (after theme swap and on/off). */
  sprite?: string;
  /** Character look. */
  look?: Look;
  intern?: boolean;
  /** Character: the spot it occupies. */
  spot?: string;
  /** Character: drawn seated (frame lowered by the seat drop). */
  seated?: boolean;
  x: number;
  y: number;
  sortY: number;
}

/** A built room. `project` is null only when the snapshot has no projects. */
export interface Scene {
  project: Project | null;
  theme: Theme;
  seats: Map<string, string>;
  overflow: string[];
  items: DrawItem[];
  lamps: Set<string>;
}

/** Lights that are always on (P-8). */
export const ALWAYS_LIT: readonly string[] = ['lamp:coffee', 'moon:window'];

/** The active project: the one with `activeProjectId`, else (null or missing) the first. */
export function selectProject(snapshot: Snapshot, activeProjectId: string | null): Project | null {
  return snapshot.projects.find((p) => p.id === activeProjectId) ?? snapshot.projects[0] ?? null;
}

/** Order of the dynamic layer: sortY, then x, then id. */
export function compareItems(a: DrawItem, b: DrawItem): number {
  return a.sortY - b.sortY || a.x - b.x || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0);
}

/** The prop with its theme swap and on/off state applied, or null if the theme hides it. */
function resolveProp(p: Prop, theme: Theme, lamps: ReadonlySet<string>): string | null {
  const sprite = themedSprite(theme, p.slot, p.sprite);
  if (sprite === null) return null;
  return p.off !== undefined && p.lamp !== undefined && !lamps.has(p.lamp) ? p.off : sprite;
}

/** Background props of a theme (layer `bg`, cached per room + theme), as draw items in layout order. */
export function backgroundProps(theme: Theme): DrawItem[] {
  return PROPS.filter((p) => p.layer === 'bg').flatMap((p): DrawItem[] => {
    const sprite = themedSprite(theme, p.slot, p.sprite);
    return sprite === null ? [] : [{ kind: 'prop', id: p.slot, sprite, x: p.x, y: p.y, sortY: p.sortY ?? p.y }];
  });
}

/** Statuses whose desk lamp and monitor glow are on (R13): the desk is in use. */
const LIT_STATUSES: ReadonlySet<Character['status']> = new Set(['busy', 'waiting']);

/**
 * True if an ended character's desk is tidied at server time `nowMs` (R2, PL4): ended for
 * `TIDY_AFTER_MS` since its last activity (or with none). Never without `nowMs`.
 */
export function tidied(c: Pick<Character, 'status' | 'lastActivityAt'>, nowMs: number | null | undefined): boolean {
  if (nowMs === null || nowMs === undefined || c.status !== 'ended') return false;
  if (c.lastActivityAt === null) return true;
  const at = Date.parse(c.lastActivityAt);
  return Number.isNaN(at) || nowMs - at >= TIDY_AFTER_MS;
}

/**
 * Builds the room of `projectId` (falls back like `selectProject`); `previousSeats` keeps seats
 * sticky. With `nowMs` (estimated server time, #5), tidied ended characters lose their seat.
 */
export function buildScene(
  snapshot: Snapshot,
  projectId: string | null,
  previousSeats?: ReadonlyMap<string, string>,
  opts: { hideEnded?: boolean; nowMs?: number | null } = {}, // #6, #5 nowMs
): Scene {
  const project = selectProject(snapshot, projectId);
  const theme = themeFor(project?.id ?? '');
  const inRoom = (c: Character): boolean => c.projectId === project?.id && !tidied(c, opts.nowMs); // #5 tidy (R2)
  const characters = project === null ? [] : snapshot.characters.filter(inRoom);
  const { seats, overflow } = assignSeats(characters, SPOTS, previousSeats);

  const lamps = new Set<string>([...ALWAYS_LIT, ...theme.lights]);
  const items: DrawItem[] = [];
  for (const c of characters) {
    const name = seats.get(c.id);
    if (name === undefined) continue;
    // #6 inspector-ui hooks: hide ended skips drawing, not seating (P-4), so the room never reshuffles.
    if (opts.hideEnded === true && c.status === 'ended') continue;
    // end #6 inspector-ui hooks
    const s = spotByName(name);
    const intern = c.kind === 'agent';
    const frame = characterFrame(s, intern);
    items.push({
      kind: 'character',
      id: c.id,
      look: lookFor(c.id, intern),
      intern,
      spot: name,
      seated: isSeated(s.kind),
      x: frame.x,
      y: frame.y,
      sortY: s.y,
    });
    if (LIT_STATUSES.has(c.status) && s.lamp !== undefined) {
      lamps.add(s.lamp);
      lamps.add(`glow:${name}`);
    }
  }
  for (const p of PROPS) {
    if (p.layer !== 'sort') continue;
    const sprite = resolveProp(p, theme, lamps);
    if (sprite !== null) items.push({ kind: 'prop', id: p.slot, sprite, x: p.x, y: p.y, sortY: p.sortY ?? p.y });
  }
  items.sort(compareItems);
  return { project, theme, seats, overflow, items, lamps };
}

// ---- Wall content (Phase 16, OFFICE-7 static content) ----

/** Done-wall slots (layout `done-1` ... `done-12`). */
export const DONE_SLOTS = 12;
/** Px between the wave text and the CTO text on the whiteboard. */
const WALL_TEXT_GAP = 3;
/** Most glyphs of the wave text and of a done label. */
const WAVE_GLYPHS = 4;
const LABEL_GLYPHS = 3;
/** The certificate of a filled done frame: x 3-13, y 3-9 of the 16x12 sprite (inside its top/left shadow). */
const CERT = { dx: 3, dy: 3, w: 11 } as const;

/** A text on the wall: ink top-left `(x, y)` on a paper `box` (1 px around the cap height). */
export interface WallText {
  id: string;
  text: string;
  x: number;
  y: number;
  box: { x: number; y: number; w: number; h: number };
}

/** One done-wall slot: a filled frame with its cycle number, or an empty frame. */
export interface WallFrame {
  slot: string;
  sprite: 'done-frame' | 'done-frame-empty';
  x: number;
  y: number;
  /** Filled frames: the cycle number on the certificate. */
  label?: WallText;
}

/** Whiteboard texts and the done wall of a harness room. */
export interface WallContent {
  texts: WallText[];
  frames: WallFrame[];
  /** Caption plate `<nn> <slug>` under the newest filled frame (#5, R8); null without outcomes. */
  plate: WallText | null;
}

/** Px between the done wall's bottom row and the caption plate's paper box. */
const PLATE_GAP = 2;

const clip = (text: string, n: number): string => [...text].slice(0, n).join('');

/** `text` with its ink at `(x, y)` and a paper box of 1 px around its cap height. */
function wallText(id: string, text: string, x: number, y: number): WallText {
  return { id, text, x, y, box: { x: x - 1, y: y - 1, w: measure(text) + 2, h: CAP_HEIGHT + 2 } };
}

/**
 * The static wall content of `project` (pure): on the whiteboard the wave (e.g. `W2`) and
 * `CTO <gen>`; on the done wall the last 12 outcomes by cycle number as filled frames in
 * slot order, each with its zero-padded `nn` on the certificate, the other slots empty.
 * Null for a non-harness room (the layout's empty frames stay).
 */
export function wallContent(project: Project | null): WallContent | null {
  const harness = project?.harness ?? null;
  if (harness === null) return null;
  const texts: WallText[] = [];
  let x: number = WHITEBOARD_TEXT.x;
  if (harness.wave !== null && harness.wave !== '') {
    const wave = wallText('wave', clip(harness.wave, WAVE_GLYPHS), x, WHITEBOARD_TEXT.y);
    texts.push(wave);
    x += measure(wave.text) + WALL_TEXT_GAP;
  }
  if (harness.ctoGeneration !== null) {
    texts.push(wallText('cto', `CTO ${String(harness.ctoGeneration)}`, x, WHITEBOARD_TEXT.y));
  }
  const done = [...harness.outcomes].sort((a, b) => a.nn - b.nn).slice(-DONE_SLOTS);
  const frames: WallFrame[] = [];
  for (let i = 0; i < DONE_SLOTS; i++) {
    const slot = `done-${String(i + 1)}`;
    const p = PROPS.find((q) => q.slot === slot);
    if (p === undefined) continue;
    const o = done[i];
    if (o === undefined) {
      frames.push({ slot, sprite: 'done-frame-empty', x: p.x, y: p.y });
      continue;
    }
    const text = clip(String(o.nn).padStart(2, '0'), LABEL_GLYPHS);
    const label: WallText = {
      ...wallText(`${slot}:label`, text, p.x + CERT.dx + Math.floor((CERT.w - measure(text)) / 2), p.y + CERT.dy + 1),
      box: { x: p.x + CERT.dx, y: p.y + CERT.dy, w: CERT.w, h: CAP_HEIGHT + 2 },
    };
    frames.push({ slot, sprite: 'done-frame', x: p.x, y: p.y, label });
  }
  return { texts, frames, plate: captionPlate(frames, done[done.length - 1]) };
}

/**
 * The caption plate of the newest outcome (R8): `<nn> <slug>` below the done wall's bottom
 * row, starting at the newest frame's x, cut glyph by glyph so its paper box ends at the
 * wall's right edge at the latest. Below the wall, not right under the frame, so a plate
 * of a top-row frame never covers the bottom row.
 */
function captionPlate(frames: readonly WallFrame[], newest: { nn: number; slug: string } | undefined): WallText | null {
  if (newest === undefined) return null;
  const frame = frames.filter((f) => f.sprite === 'done-frame').at(-1);
  if (frame === undefined) return null;
  const wall = doneWallArea();
  const room = wall.x + wall.w - frame.x - 2;
  const glyphs = [...`${String(newest.nn).padStart(2, '0')} ${newest.slug}`];
  let text = glyphs.join('');
  for (let n = glyphs.length; n > 0 && measure(text) > room; n--) text = glyphs.slice(0, n - 1).join('');
  if (text === '') return null;
  return wallText('plate', text, frame.x + 1, wall.y + wall.h + PLATE_GAP + 1);
}

/** Cache key of `content`: the room background is rebuilt when it changes. */
export function wallKey(content: WallContent | null): string {
  if (content === null) return '';
  const parts = [...content.texts.map((t) => t.text), ...content.frames.map((f) => f.label?.text ?? '-')];
  if (content.plate !== null) parts.push(content.plate.text);
  return parts.join('|');
}

/** `t` as a raster: its paper box with the ink text in it. */
export function wallTextRaster(t: WallText): Raster {
  const out = blank(t.box.w, t.box.h);
  const paper = rgba(ART_COLOURS.wallPaper);
  for (let i = 0; i < out.w * out.h; i++) out.data.set(paper, i * 4);
  blit(out, textRaster(t.text, ART_COLOURS.wallInk), t.x - t.box.x, t.y - t.box.y);
  return out;
}
