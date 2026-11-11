// Sprite family `tiles` (plan step 3.1): the 16x16 tiles of the room shell —
// floors, walls, ceiling, beam and the glass partition of the CTO office.
// Tiles are drawn in the materials' own colours; the light layer (P-8) dims the
// room to night and lets lamps pool warm light on top. Every opaque tile repeats
// seamlessly in x and y; tiles with `.` (skirting, beam, slopes, partitions) are
// drawn over the wall, floor or ceiling tile beneath them. DOM-free.
import { grid, planks, rng } from '../kit.js';
import type { Family, Grid, SpriteDef } from '../types.js';

const T = 16;

/** A tile from a grid and its key. */
function tile(id: string, g: Grid, key: Record<string, string>): SpriteDef {
  return { id, w: T, h: T, grid: g, key };
}

/** Per-pixel overrides on a grid: `paint(x, y, ch)` returns a replacement char or undefined to keep it. */
function retouch(g: Grid, paint: (x: number, y: number, ch: string) => string | undefined): Grid {
  return g.map((row, y) => [...row].map((ch, x) => paint(x, y, ch) ?? ch).join(''));
}

/**
 * Wooden floorboards: 4-px planks with a dark seam row, staggered joints with a lit
 * edge after each joint, and short grain streaks (`g`) seeded per variant. `k` = knot.
 */
function floorWood(seed: number, knot: { x: number; y: number } | null): Grid {
  const base = planks(T, T, { fill: '2', seam: '1', light: '3', plank: 4, seed });
  const r = rng(seed * 97 + 5);
  const streaks = new Set<string>();
  for (let i = 0; i < 7; i++) {
    const x = Math.floor(r() * T);
    const y = Math.floor(r() * 4) * 4 + 1 + Math.floor(r() * 2);
    const len = 2 + Math.floor(r() * 3);
    for (let d = 0; d < len; d++) streaks.add(`${String((x + d) % T)},${String(y)}`);
  }
  return retouch(base, (x, y, ch) => {
    if (knot && ((x === knot.x && y === knot.y) || (x === knot.x + 1 && y === knot.y))) return 'k';
    if (ch === '2' && streaks.has(`${String(x)},${String(y)}`)) return 'g';
    return undefined;
  });
}

const WOOD_FLOOR_KEY = { '1': 'wood0', '2': 'wood2', '3': 'wood3', g: 'wood1', k: 'wood0' };

/** Short-pile carpet of the CTO office: a quiet diagonal twill (dark rib, lit rib) on plum, with a few blue tufts. */
function carpet(): Grid {
  const r = rng(41);
  return grid(T, T, (x, y) => {
    const d = (x + 2 * y) % 8;
    if (d === 0) return '1';
    if (d === 1) return '3';
    return r() < 0.03 ? 'b' : '2';
  });
}

/** Kitchen floor: flat 8-px lino checker with a 1-px grout line and a shine pixel on each light square. */
function checker(): Grid {
  return grid(T, T, (x, y) => {
    const light = (Math.floor(x / 8) + Math.floor(y / 8)) % 2 === 0;
    const lx = x % 8;
    const ly = y % 8;
    if (lx === 7 || ly === 7) return 'o';
    if (light && lx === 1 && ly === 1) return 'C';
    return light ? 'W' : 'd';
  });
}

/** Plaster wall of the nerd room: lavender-grey with sparse dark pits and light flecks. */
function plaster(): Grid {
  const r = rng(73);
  return grid(T, T, () => {
    const v = r();
    if (v < 0.035) return '1';
    if (v < 0.05) return '3';
    return '2';
  });
}

/** Wallpaper of the neon room: dark plum with a magenta pinstripe every 8 px and a small diamond between. */
function wallpaper(): Grid {
  return grid(T, T, (x, y) => {
    if (x % 8 === 0) return 'm';
    const cx = (x % 8) - 4;
    const cy = (y % 8) - 4;
    if (Math.abs(cx) + Math.abs(cy) === 1 && y % 16 < 8) return 'n';
    if (cx === 0 && cy === 0 && y % 16 < 8) return 'm';
    return '2';
  });
}

/** Skirting board over the bottom of a wall tile: transparent above, a wooden board with a lit top. */
function skirting(): Grid {
  return grid(T, T, (x, y) => {
    if (y < 10) return '.';
    if (y === 10) return 'o';
    if (y === 11) return '3';
    if (y === 15) return 'o';
    if (y === 14) return '1';
    return x % 16 === 5 && y === 13 ? '1' : '2';
  });
}

/** Ceiling boards in shadow (purple planks); the beams and rafters carry the wood. */
function ceilingBoards(): Grid {
  return planks(T, T, { fill: '2', seam: '1', light: '3', plank: 4, seed: 9 });
}

/**
 * Left end of the sloped attic ceiling: boards above the diagonal x + y = 15, a
 * rafter band along it (outline, lit edge, body, shade, outline), transparent
 * below so the wall shows through. Two of these on the diagonal plus one
 * `ceiling-flat` in the corner make a 32x32 slope.
 */
function slopeLeft(): Grid {
  const boards = ceilingBoards();
  return grid(T, T, (x, y) => {
    const d = x + y;
    if (d < 12) return boards[y]?.charAt(x) ?? '2';
    if (d === 12) return 'o';
    if (d === 13) return 'L';
    if (d === 14) return 'B';
    if (d === 15) return 'S';
    if (d === 16) return 'o';
    return '.';
  });
}

/** Mirror of a grid left <-> right. */
function mirror(g: Grid): Grid {
  return g.map((row) => [...row].reverse().join(''));
}

/** A horizontal wooden beam across the ceiling, 10 px tall with a lit top and grain; transparent above and below. */
function beam(): Grid {
  return grid(T, T, (x, y) => {
    if (y < 3 || y > 12) return '.';
    if (y === 3 || y === 12) return 'o';
    if (y === 4) return '3';
    if (y === 11 || y === 10) return '1';
    if ((y === 6 && x >= 2 && x <= 6) || (y === 8 && x >= 9 && x <= 14)) return '1';
    if (x === 12 && y === 5) return 'k';
    return '2';
  });
}

/** Glass partition seen edge-on (the CTO office's right side): frame, highlight, two glass tones; a glint every 8 rows. */
function partitionV(): Grid {
  return grid(T, T, (x, y) => {
    if (x < 5 || x > 10) return '.';
    if (x === 5 || x === 10) return 'o';
    if (x === 6) return 'h';
    if (x === 9) return 'a';
    return y % 8 === 2 && x === 7 ? 'h' : 'b';
  });
}

/**
 * Glass partition seen face-on (the CTO office's bottom side): a top rail, clear
 * glass (transparent, with a sparse blue tint and two diagonal reflections) and a
 * base rail.
 */
function partitionH(): Grid {
  return grid(T, T, (x, y) => {
    if (y === 0) return 'o';
    if (y === 1) return 'h';
    if (y === 2) return 'a';
    if (y === 13) return 'o';
    if (y === 14) return 'r';
    if (y === 15) return 'o';
    const d = (x + y) % T;
    if (d === 4 || d === 5 || d === 8) return 'h';
    return x % 4 === 1 && y % 4 === 3 ? 'b' : '.';
  });
}

const WOOD_KEY = { o: 'wood0', '1': 'wood1', '2': 'wood2', '3': 'wood3', k: 'wood0' };
const BOARDS_KEY = { '1': 'night1', '2': 'night2', '3': 'night3' };

const SPRITES: SpriteDef[] = [
  tile('floor-wood-a', floorWood(1, null), WOOD_FLOOR_KEY),
  tile('floor-wood-b', floorWood(2, { x: 10, y: 9 }), WOOD_FLOOR_KEY),
  tile('floor-carpet', carpet(), { '1': 'night1', '2': 'night2', '3': 'night3', b: 'blue0' }),
  tile('floor-kitchen', checker(), {
    W: 'night4',
    C: 'lamp2',
    d: 'night2',
    o: 'night3',
  }),
  tile('wall-nerd', plaster(), { '1': 'night2', '2': 'night3', '3': 'night4' }),
  tile('wall-neon', wallpaper(), { '2': 'night2', m: 'magenta0', n: 'night3' }),
  tile('wall-skirting', skirting(), WOOD_KEY),
  tile('ceiling-slope-l', slopeLeft(), { ...BOARDS_KEY, o: 'wood0', L: 'wood3', B: 'wood2', S: 'wood1' }),
  tile('ceiling-slope-r', mirror(slopeLeft()), { ...BOARDS_KEY, o: 'wood0', L: 'wood3', B: 'wood2', S: 'wood1' }),
  tile('ceiling-flat', ceilingBoards(), BOARDS_KEY),
  tile('beam', beam(), WOOD_KEY),
  tile('partition-v', partitionV(), { o: 'night1', h: 'night4', a: 'night2', b: 'blue0' }),
  tile('partition-h', partitionH(), { o: 'night1', h: 'night4', a: 'night3', r: 'night2', b: 'blue1' }),
];

/** The `tiles` family; preview sheet `var/sprites/tiles.png`. */
export const tilesFamily: Family = { name: 'tiles', sprites: SPRITES };
