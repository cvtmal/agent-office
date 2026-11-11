// The room template (plan P-2, P-3): zones, named spots and prop placements of the
// 480x270 office, the same for every project (themes swap props by slot, P-7).
// Hotspot owned by #2: other cycles add named spots for their own props only. DOM-free.
import type { LaneLetter } from '../../shared/constants.js';
import { spriteById } from '../sprites/registry.js';

/** Scene size in px (OFFICE-1). */
export const SCENE_W = 480;
export const SCENE_H = 270;

/** Tile size in px; the room is 30 x 17 tiles, the last row cropped to 14 px. */
export const TILE = 16;
export const COLS = 30;
export const ROWS = 17;

/** Standing character frame (agents) and intern frame, in px. */
export const FRAME_W = 32;
export const FRAME_H = 48;
export const INTERN_W = 24;
export const INTERN_H = 36;

/** A seated frame is drawn this many px lower than a standing one (behind the desk front). */
export const SEAT_DROP = 13;
export const SEAT_DROP_INTERN = 9;

/** An axis-aligned rectangle in scene px. */
export interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
}

/** Zone names of the room. */
export type ZoneName =
  | 'ceiling'
  | 'backWall'
  | 'cto'
  | 'groupA'
  | 'groupB'
  | 'groupC'
  | 'groupD'
  | 'aisleL'
  | 'aisleR'
  | 'open'
  | 'kitchen';

const tiles = (col: number, row: number, cols: number, rows: number): Rect => ({
  x: col * TILE,
  y: row * TILE,
  w: cols * TILE,
  h: Math.min(rows * TILE, SCENE_H - row * TILE),
});

/** Zones in px (P-2). The back wall overlaps the ceiling band; the rest do not overlap. */
export const ZONES: Readonly<Record<ZoneName, Rect>> = {
  ceiling: tiles(0, 0, 30, 2),
  backWall: tiles(0, 0, 30, 5),
  cto: tiles(0, 5, 7, 8),
  groupA: tiles(8, 5, 7, 4),
  groupB: tiles(15, 5, 7, 4),
  groupC: tiles(8, 9, 7, 4),
  groupD: tiles(15, 9, 7, 4),
  aisleL: tiles(7, 5, 1, 12),
  aisleR: tiles(22, 5, 1, 12),
  open: tiles(0, 13, 22, 4),
  kitchen: tiles(23, 5, 7, 12),
};

/** What a spot is for (P-3). */
export type SpotKind = 'cto' | 'desk' | 'intern' | 'open' | 'stand' | 'kitchen' | 'couch' | 'door';

/** A named place for a character. `(x, y)` is the feet anchor (bottom centre) of a standing frame. */
export interface Spot {
  name: string;
  kind: SpotKind;
  x: number;
  y: number;
  /** Desk group of `desk` and group `intern` spots. */
  group?: LaneLetter;
  /** Which desk of the group a `desk` spot is. */
  slot?: 'lead' | 'second';
  /** Intern spots: the desk spot they belong to. */
  desk?: string;
  /** Spots with a desk: the id of its lamp (`lamp:<spot>`, `lamp:cto`). Its monitor is `glow:<spot>`. */
  lamp?: string;
}

/** Kinds whose occupant sits (seated frame, P-3); the others stand. */
const SEATED: ReadonlySet<SpotKind> = new Set<SpotKind>(['cto', 'desk', 'intern', 'open', 'couch']);

/** True if a character at this spot is drawn seated. */
export function isSeated(kind: SpotKind): boolean {
  return SEATED.has(kind);
}

/** The frame rectangle (draw position and size) of a character at `spot` (P-3). */
export function characterFrame(spot: Spot, intern: boolean): Rect {
  const w = intern ? INTERN_W : FRAME_W;
  const h = intern ? INTERN_H : FRAME_H;
  const drop = isSeated(spot.kind) ? (intern ? SEAT_DROP_INTERN : SEAT_DROP) : 0;
  return { x: spot.x - w / 2, y: spot.y - h + drop, w, h };
}

// Desk-row geometry. A desk spot's seated frame spans y-35..y+13; its desk y-12..y+12.
const GROUP_ROW_Y = { top: 124, bottom: 188 } as const;
const OPEN_Y = 250;
const STAND_Y = 262;

/** Desk group origins (top-left of the group zone). */
const GROUP_ORIGIN: Readonly<Record<LaneLetter, { x: number; y: number }>> = {
  A: { x: ZONES.groupA.x, y: GROUP_ROW_Y.top },
  B: { x: ZONES.groupB.x, y: GROUP_ROW_Y.top },
  C: { x: ZONES.groupC.x, y: GROUP_ROW_Y.bottom },
  D: { x: ZONES.groupD.x, y: GROUP_ROW_Y.bottom },
};

const LETTERS: readonly LaneLetter[] = ['A', 'B', 'C', 'D'];

/** A group, left to right: intern-1 (24) | lead (32) | second (32) | intern-2 (24) = 112 px. */
function groupSpots(g: LaneLetter): Spot[] {
  const { x, y } = GROUP_ORIGIN[g];
  return [
    { name: `${g}-lead`, kind: 'desk', x: x + 40, y, group: g, slot: 'lead', lamp: `lamp:${g}-lead` },
    { name: `${g}-second`, kind: 'desk', x: x + 72, y, group: g, slot: 'second', lamp: `lamp:${g}-second` },
    { name: `${g}-intern-1`, kind: 'intern', x: x + 12, y, group: g, desk: `${g}-lead` },
    { name: `${g}-intern-2`, kind: 'intern', x: x + 100, y, group: g, desk: `${g}-second` },
  ];
}

/**
 * Open area, left to right (352 px exactly): stand-1 | open-1 | i1 i2 | open-2 open-3 |
 * i3 i4 | open-4 open-5 open-6 | stand-2. Each intern spot sits right beside its desk.
 */
const OPEN_SPOTS: Spot[] = [
  { name: 'open-1', kind: 'open', x: 48, y: OPEN_Y, lamp: 'lamp:open-1' },
  { name: 'open-2', kind: 'open', x: 128, y: OPEN_Y, lamp: 'lamp:open-2' },
  { name: 'open-3', kind: 'open', x: 160, y: OPEN_Y, lamp: 'lamp:open-3' },
  { name: 'open-4', kind: 'open', x: 240, y: OPEN_Y, lamp: 'lamp:open-4' },
  { name: 'open-5', kind: 'open', x: 272, y: OPEN_Y, lamp: 'lamp:open-5' },
  { name: 'open-6', kind: 'open', x: 304, y: OPEN_Y, lamp: 'lamp:open-6' },
  { name: 'open-intern-1', kind: 'intern', x: 76, y: OPEN_Y, desk: 'open-1' },
  { name: 'open-intern-2', kind: 'intern', x: 100, y: OPEN_Y, desk: 'open-2' },
  { name: 'open-intern-3', kind: 'intern', x: 188, y: OPEN_Y, desk: 'open-3' },
  { name: 'open-intern-4', kind: 'intern', x: 212, y: OPEN_Y, desk: 'open-4' },
  { name: 'stand-1', kind: 'stand', x: 16, y: STAND_Y },
  { name: 'stand-2', kind: 'stand', x: 336, y: STAND_Y },
];

const CTO_SPOT: Spot = { name: 'cto', kind: 'cto', x: 56, y: 150, lamp: 'lamp:cto' };

/** Every named spot, in a fixed order (cto, groups A-D, open area, kitchen, door). */
export const SPOTS: readonly Spot[] = [
  CTO_SPOT,
  ...LETTERS.flatMap(groupSpots),
  ...OPEN_SPOTS,
  { name: 'kitchen-1', kind: 'kitchen', x: 384, y: 128 },
  { name: 'kitchen-2', kind: 'kitchen', x: 416, y: 128 },
  { name: 'kitchen-3', kind: 'kitchen', x: 448, y: 128 },
  { name: 'kitchen-4', kind: 'kitchen', x: 400, y: 176 },
  { name: 'couch-1', kind: 'couch', x: 408, y: 222 },
  { name: 'couch-2', kind: 'couch', x: 440, y: 222 },
  { name: 'door', kind: 'door', x: 120, y: 92 },
];

const SPOT_BY_NAME = new Map(SPOTS.map((s) => [s.name, s]));

/** The spot with this name; throws on an unknown name (a layout bug). */
export function spot(name: string): Spot {
  const s = SPOT_BY_NAME.get(name);
  if (s === undefined) throw new Error(`unknown spot: ${name}`);
  return s;
}

/** A prop placed in the room. `(x, y)` is the sprite's top-left. */
export interface Prop {
  /** Unique slot name; themes swap the sprite of a slot by this name (P-7). */
  slot: string;
  /** Default sprite id (a theme may swap or hide it). */
  sprite: string;
  x: number;
  y: number;
  /** `bg`: drawn into the cached background; `sort`: y-sorted with the characters by `sortY`. */
  layer: 'bg' | 'sort';
  sortY?: number;
  /** The spot this prop belongs to (desk furniture). */
  spot?: string;
  /** Sprite shown instead while the prop's lamp is off (`monitor-off`). */
  off?: string;
  /** Light this prop emits (P-8); its point is the sprite's centre. */
  lamp?: string;
}

/**
 * Sprite sizes of the room manifests of Phases 3, 7 and 8 (the contract the layout was
 * placed against). The sprite tests pin the art to these sizes; every id now exists in
 * the registry, which is the only source `spriteSize` reads.
 */
export const PLANNED_SPRITES: Readonly<Record<string, readonly [number, number]>> = {
  // Phase 3: tiles and shell
  'floor-wood-a': [16, 16],
  'floor-wood-b': [16, 16],
  'floor-carpet': [16, 16],
  'floor-kitchen': [16, 16],
  'wall-nerd': [16, 16],
  'wall-neon': [16, 16],
  'wall-skirting': [16, 16],
  'ceiling-slope-l': [16, 16],
  'ceiling-slope-r': [16, 16],
  'ceiling-flat': [16, 16],
  beam: [16, 16],
  'partition-v': [16, 16],
  'partition-h': [16, 16],
  'window-night': [80, 48],
  door: [32, 56],
  'wall-trim': [16, 4],
  // Phase 7: furniture
  'desk-cto': [64, 32],
  'desk-cto-top': [32, 12],
  'lamp-cto': [16, 24],
  'chair-cto': [24, 28],
  'chair-visitor': [20, 20],
  'plant-tall': [16, 32],
  'rug-cto': [64, 32],
  desk: [32, 24],
  'desk-open': [32, 24],
  monitor: [14, 14],
  'monitor-off': [14, 14],
  'lamp-desk': [10, 16],
  chair: [20, 20],
  stool: [14, 10],
  keyboard: [12, 4],
  mug: [6, 6],
  papers: [10, 6],
  // Phase 8: wall
  whiteboard: [96, 48],
  'done-frame': [16, 12],
  'done-frame-empty': [16, 12],
  'done-sign': [32, 8],
  'shelf-books': [32, 32],
  'shelf-binders': [32, 32],
  'poster-map': [16, 24],
  'poster-rocket': [16, 24],
  'poster-wave': [16, 24],
  'sticky-notes': [16, 12],
  clock: [12, 12],
  'neon-sign': [32, 16],
  'fairy-lights': [64, 8],
  'plant-hanging': [16, 24],
  cables: [16, 6],
  // Phase 8: kitchen
  counter: [64, 32],
  'coffee-machine': [16, 24],
  couch: [64, 32],
  'rug-kitchen': [64, 32],
  'plant-small': [16, 16],
  'plant-floor': [16, 28],
  fridge: [24, 44],
  boxes: [24, 16],
  bin: [12, 12],
  kettle: [10, 10],
};

/** Tile kinds of the room grid; a theme maps each to a tile sprite. */
export type TileKind = 'ceiling' | 'slope-l' | 'slope-r' | 'wall' | 'skirting' | 'floor' | 'carpet' | 'kitchen';

/**
 * Which tile goes at (col, row): slanted ceiling at both ends, wall rows 1-4, floors by
 * zone. The rafter runs along x + y = 31 from each end, so the two outer corner cells of
 * row 0 lie above it and are flat ceiling.
 */
export function tileKind(col: number, row: number): TileKind {
  if (row === 0 && (col === 0 || col === COLS - 1)) return 'ceiling';
  if (row === 0) return col <= 1 ? 'slope-l' : col >= COLS - 2 ? 'slope-r' : 'ceiling';
  if (row === 1 && col === 0) return 'slope-l';
  if (row === 1 && col === COLS - 1) return 'slope-r';
  if (row <= 3) return 'wall';
  if (row === 4) return 'skirting';
  if (col >= 23) return 'kitchen';
  if (col <= 6 && row <= 12) return 'carpet';
  return 'floor';
}

/**
 * Furniture of one desk spot (P-4): chair behind, desk front after the character, monitor
 * and lamp on top. The monitor's screen faces the sitter: `monitor` stands left of the
 * sitter and faces right, `monitor-l` (its mirror) stands right and faces left.
 */
function deskProps(s: Spot, deskSprite: 'desk' | 'desk-open', monitorRight: boolean): Prop[] {
  const { x, y, name } = s;
  const monitorX = monitorRight ? x + 1 : x - 15;
  const lampX = monitorRight ? x - 15 : x + 5;
  return [
    { slot: `chair:${name}`, sprite: 'chair', x: x - 10, y: y - 20, layer: 'sort', sortY: y - 1, spot: name },
    { slot: `desk:${name}`, sprite: deskSprite, x: x - 16, y: y - 12, layer: 'sort', sortY: y + 1, spot: name },
    {
      slot: `monitor:${name}`,
      sprite: monitorRight ? 'monitor-l' : 'monitor',
      x: monitorX,
      y: y - 21,
      layer: 'sort',
      sortY: y + 2,
      spot: name,
      off: monitorRight ? 'monitor-off-l' : 'monitor-off',
      lamp: `glow:${name}`,
    },
    {
      slot: `lamp:${name}`,
      sprite: 'lamp-desk',
      x: lampX,
      y: y - 22,
      layer: 'sort',
      sortY: y + 2,
      spot: name,
      lamp: `lamp:${name}`,
    },
    { slot: `keyboard:${name}`, sprite: 'keyboard', x: x - 6, y: y - 10, layer: 'sort', sortY: y + 2, spot: name },
  ];
}

/** An intern's stool, behind the intern. */
function stoolProp(s: Spot): Prop {
  return { slot: `stool:${s.name}`, sprite: 'stool', x: s.x - 7, y: s.y - 6, layer: 'sort', sortY: s.y - 1, spot: s.name };
}

const bg = (slot: string, sprite: string, x: number, y: number, extra: Partial<Prop> = {}): Prop => ({
  slot,
  sprite,
  x,
  y,
  layer: 'bg',
  ...extra,
});

const sorted = (slot: string, sprite: string, x: number, y: number, sortY: number, extra: Partial<Prop> = {}): Prop => ({
  slot,
  sprite,
  x,
  y,
  layer: 'sort',
  sortY,
  ...extra,
});

const range = (n: number): number[] => Array.from({ length: n }, (_, i) => i);

/** Back wall (P-2): window (cols 1-5), door (7-8), whiteboard (9-14), done wall (15-21), kitchen wall (23-29). */
const WALL_PROPS: Prop[] = [
  ...range(COLS).map((c) => bg(`trim-${String(c)}`, 'wall-trim', c * TILE, 76)),
  ...[8, 15, 23].map((c) => bg(`beam-${String(c)}`, 'beam', c * TILE, 0)),
  bg('window', 'window-night', 16, 28, { lamp: 'moon:window' }),
  bg('wall-deco-1', 'poster-rocket', 96, 36),
  bg('sticky-notes', 'sticky-notes', 96, 62),
  bg('door', 'door', 112, 24),
  bg('whiteboard', 'whiteboard', 144, 26),
  bg('done-sign', 'done-sign', 280, 26),
  ...range(12).map((i) =>
    bg(`done-${String(i + 1)}`, 'done-frame-empty', 243 + (i % 6) * 18, 38 + Math.floor(i / 6) * 16),
  ),
  bg('wall-deco-3', 'poster-wave', 352, 36),
  bg('clock', 'clock', 354, 62),
  bg('wall-plant', 'plant-hanging', 370, 26),
  bg('wall-string', 'fairy-lights', 400, 18),
  bg('kitchen-shelf', 'shelf-books', 408, 30),
  bg('wall-deco-2', 'poster-map', 444, 28),
];

/**
 * Top-left of the whiteboard's text line (Phase 16, OFFICE-7 static content): the wave,
 * then `CTO <gen>`, in the clear strip under the card board (board-local x 5, y 31).
 */
export const WHITEBOARD_TEXT = { x: 149, y: 57 } as const;

/** CTO corner office (cols 0-6, rows 5-12): glass partition right and bottom with a door gap at cols 4-5. */
const CTO_PROPS: Prop[] = [
  ...range(8).map((r) => sorted(`partition-v-${String(r)}`, 'partition-v', 96, 80 + r * TILE, 96 + r * TILE)),
  ...[0, 1, 2, 3, 6].map((c) => sorted(`partition-h-${String(c)}`, 'partition-h', c * TILE, 192, 208)),
  bg('rug-cto', 'rug-cto', 24, 160),
  bg('cto-shelf', 'shelf-binders', 0, 80),
  sorted('cto-plant', 'plant-tall', 76, 84, 116),
  sorted('chair:cto', 'chair-cto', 44, 112, CTO_SPOT.y - 1, { spot: 'cto' }),
  sorted('desk:cto', 'desk-cto', 24, 136, CTO_SPOT.y + 1, { spot: 'cto' }),
  sorted('desk-top:cto', 'desk-cto-top', 40, 132, CTO_SPOT.y + 2, { spot: 'cto' }),
  sorted('monitor:cto', 'monitor', 26, 124, CTO_SPOT.y + 2, { spot: 'cto', off: 'monitor-off', lamp: 'glow:cto' }),
  sorted('lamp:cto', 'lamp-cto', 72, 116, CTO_SPOT.y + 2, { spot: 'cto', lamp: 'lamp:cto' }),
  sorted('papers:cto', 'papers', 60, 136, CTO_SPOT.y + 3, { spot: 'cto' }),
  sorted('chair-visitor', 'chair-visitor', 46, 166, 186),
];

/** Kitchen (cols 23-29, rows 5-16): counter with coffee machine against the wall, fridge, couch, rug, plants. */
const KITCHEN_PROPS: Prop[] = [
  sorted('counter', 'counter', 376, 64, 96),
  sorted('coffee-machine', 'coffee-machine', 380, 44, 97, { lamp: 'lamp:coffee' }),
  sorted('kettle', 'kettle', 402, 56, 97),
  sorted('mug', 'mug', 420, 60, 97),
  sorted('fridge', 'fridge', 452, 52, 96),
  sorted('bin', 'bin', 440, 86, 98),
  bg('rug-kitchen', 'rug-kitchen', 392, 232),
  sorted('couch', 'couch', 392, 196, 221),
  sorted('kitchen-plant', 'plant-small', 372, 212, 228),
  sorted('plant-floor', 'plant-floor', 460, 236, 264),
  sorted('boxes', 'boxes', 372, 250, 266),
];

/** Every prop of the room. Desk props are named `<thing>:<spot>`; theme slots by plain names. */
export const PROPS: readonly Prop[] = [
  ...WALL_PROPS,
  ...CTO_PROPS,
  ...SPOTS.filter((s) => s.kind === 'desk').flatMap((s) => deskProps(s, 'desk', s.slot === 'second')),
  ...SPOTS.filter((s) => s.kind === 'open').flatMap((s) => deskProps(s, 'desk-open', false)),
  ...SPOTS.filter((s) => s.kind === 'intern').map(stoolProp),
  bg('floor-cables', 'cables', 186, 138),
  ...KITCHEN_PROPS,
];

/** Size of a sprite from the registry; undefined for an unknown id. */
export function spriteSize(id: string): { w: number; h: number } | undefined {
  const def = spriteById(id);
  return def === undefined ? undefined : { w: def.w, h: def.h };
}

/**
 * Lights of theme props (P-7, P-8): lamp id -> [prop slot, sprite a theme puts there].
 * A theme that swaps that sprite in lists the id in its `lights`.
 */
export const THEME_LIGHTS: Readonly<Record<string, readonly [slot: string, sprite: string]>> = {
  'neon:sign': ['wall-deco-2', 'neon-sign'],
  'neon:fairy': ['wall-string', 'fairy-lights'],
};

type Point = { x: number; y: number };

/** Centre of `sprite` placed at the top-left of prop `p`. */
function centre(p: Prop, sprite: string): Point {
  const size = spriteSize(sprite) ?? { w: 0, h: 0 };
  return { x: p.x + Math.floor(size.w / 2), y: p.y + Math.floor(size.h / 2) };
}

/** Light source points (P-8): lamp id -> centre of the prop that emits it. */
export const LAMP_POINTS: ReadonlyMap<string, Point> = new Map([
  ...PROPS.flatMap((p): [string, Point][] => (p.lamp === undefined ? [] : [[p.lamp, centre(p, p.sprite)]])),
  ...Object.entries(THEME_LIGHTS).flatMap(([id, [slot, sprite]]): [string, Point][] => {
    const p = PROPS.find((q) => q.slot === slot);
    return p === undefined ? [] : [[id, centre(p, sprite)]];
  }),
]);
