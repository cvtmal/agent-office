// Pose frames of the paper doll (#5 plan step 5.1/5.2, research R3, R4, R8): grid
// operations on a body in the slot alphabet (builds.ts) that compose.ts (32x48
// agents) and interns/index.ts (24x36 interns) share. Every helper works on any
// frame size and reads the body's geometry from its pixels, so all builds pose
// without per-build tables:
//   walk0..walk3  left foot lifted 1 px / body bob 1 px / right foot lifted / bob
//   head          head and hair lowered onto the forearms, which lie flat across
//                 the desk line: only the crown shows (stopped; drawn seated)
//   cheer0/1      both arms raised beside the head, hands above the brows;
//                 frame 1 one row higher
// The poses keep the idle frames' layers and palette; they only move or redraw
// slot chars. DOM-free.
import type { Grid } from '../../render/raster.js';

/** Pose frames next to the idle frames 0-3; atlas ids `look:<key>:<pose>`. */
export const POSE_FRAMES = ['walk0', 'walk1', 'walk2', 'walk3', 'head', 'cheer0', 'cheer1'] as const;

/** One pose frame name. */
export type PoseFrame = (typeof POSE_FRAMES)[number];

/** Skin slot chars (hands). */
const SKIN = new Set(['1', '2', '3']);

/** Top slot -> open-jacket slot (overlays.ts `JACKET`): raised or folded arms wear the jacket too. */
export const JACKET_SLOTS: Readonly<Record<string, string>> = { x: 'n', v: 'n', u: 'm', t: 'k' };

/** A char that is part of the figure (not transparent, not outline). */
function filled(c: string | undefined): boolean {
  return c !== undefined && c !== '.' && c !== 'o';
}

/** A grid as mutable rows of chars. */
function cells(g: Grid): string[][] {
  return g.map((row) => [...row]);
}

/** Mutable rows back to a grid. */
function rows(c: readonly (readonly string[])[]): string[] {
  return c.map((r) => r.join(''));
}

/**
 * Outline repair after pixels moved or were cleared: an empty px with a filled
 * 4-neighbour becomes outline `o`, an outline px without one becomes empty.
 * Only rows [from, to] change, so hand-drawn details elsewhere stay as drawn.
 */
export function reoutline(c: string[][], from = 0, to = c.length - 1): void {
  const at = (x: number, y: number): string | undefined => c[y]?.[x];
  const near = (x: number, y: number): boolean =>
    filled(at(x - 1, y)) || filled(at(x + 1, y)) || filled(at(x, y - 1)) || filled(at(x, y + 1));
  const marks: [number, number, string][] = [];
  c.forEach((row, y) => {
    if (y < from || y > to) return;
    row.forEach((ch, x) => {
      if (ch === '.' && near(x, y)) marks.push([x, y, 'o']);
      else if (ch === 'o' && !near(x, y)) marks.push([x, y, '.']);
    });
  });
  for (const [x, y, ch] of marks) {
    const row = c[y];
    if (row) row[x] = ch;
  }
}

/**
 * Walk frames 0 and 2: one foot lifted 1 px. From two rows above the shoe tops
 * (first `g` row) down, the columns of that half move up one row (the shin loses
 * a row, the sole lifts off the shadow).
 */
export function liftFoot(g: Grid, side: 'left' | 'right'): Grid {
  const c = cells(g);
  const w = c[0]?.length ?? 0;
  const shoeTop = g.findIndex((row) => row.includes('g'));
  if (shoeTop < 0) return g;
  const from = Math.max(0, shoeTop - 2);
  const [x0, x1] = side === 'left' ? [0, w / 2 - 1] : [w / 2, w - 1];
  for (let y = from; y < c.length; y++) {
    for (let x = x0; x <= x1; x++) {
      const row = c[y];
      const below = g[y + 1]?.charAt(x) ?? '';
      if (row) row[x] = below === '' ? '.' : below;
    }
  }
  reoutline(c, from - 1);
  return rows(c);
}

/** Where a body's arms are (read from its pixels). */
export interface ArmGeometry {
  /** Collar row: the first row with figure pixels. */
  top: number;
  /** First row where the arms hang apart from the chest. */
  split: number;
  /** Lowest hand row. */
  hand: number;
  /** Sleeve width (= hand width). */
  width: number;
  /** Outer columns of the left and right arm on the split row. */
  left: number;
  right: number;
  /** Outermost figure columns of the body between the collar and the hands. */
  minX: number;
  maxX: number;
}

/** Leftmost / rightmost figure column of a row, or -1. */
function edge(row: string, from: 'left' | 'right'): number {
  const xs = [...row].map((c, x) => (filled(c) ? x : -1)).filter((x) => x >= 0);
  if (xs.length === 0) return -1;
  return from === 'left' ? Math.min(...xs) : Math.max(...xs);
}

/**
 * The arm geometry of a body: hands are the lowest skin pixels in the left half,
 * the sleeve is as wide as the hand, and an arm hangs apart from the chest from
 * the first row (two below the collar or more) where the px inside the sleeve is
 * a fold `t` or outline.
 */
export function armGeometry(g: Grid): ArmGeometry {
  const w = g[0]?.length ?? 0;
  const top = g.findIndex((row) => [...row].some(filled));
  let hand = -1;
  g.forEach((row, y) => {
    if (y > top + 2 && [...row.slice(0, w / 2)].some((c) => SKIN.has(c))) hand = y;
  });
  const width = [...(g[hand] ?? '').slice(0, w / 2)].filter((c) => SKIN.has(c)).length;
  let split = top + 2;
  for (let y = top + 2; y <= hand; y++) {
    const row = g[y] ?? '';
    const inner = row.charAt(edge(row, 'left') + width);
    if (inner === 't' || inner === 'o' || inner === '.') {
      split = y;
      break;
    }
  }
  let minX = w;
  let maxX = -1;
  for (let y = top + 2; y <= hand; y++) {
    const row = g[y] ?? '';
    const l = edge(row, 'left');
    if (l >= 0) minX = Math.min(minX, l);
    maxX = Math.max(maxX, edge(row, 'right'));
  }
  const splitRow = g[split] ?? '';
  return { top, split, hand, width, left: edge(splitRow, 'left'), right: edge(splitRow, 'right'), minX, maxX };
}

/** Cheer: the body without its hanging arms (sleeves and hands from the split row down), outline repaired. */
export function dropArms(g: Grid, a: ArmGeometry): Grid {
  const c = cells(g);
  for (let y = a.split; y <= a.hand; y++) {
    const row = c[y];
    const src = g[y] ?? '';
    if (!row) continue;
    const l = edge(src, 'left');
    const r = edge(src, 'right');
    for (let k = 0; k < a.width; k++) {
      if (l >= 0) row[l + k] = '.';
      if (r >= 0) row[r - k] = '.';
    }
  }
  reoutline(c, a.split - 1, a.hand + 2);
  return rows(c);
}

/**
 * Cheer: both arms raised, as a layer drawn over the body and under the head.
 * Hands on rows `hands` and `hands + 1`, a cuff, then the sleeve down to the
 * shoulder (collar row + 1); the forearm (5 rows from the hands) leans 1 px out.
 * Light from the upper left: lit left arm, shaded right arm. Outline only where
 * `base` (the posed body) is empty.
 */
export function raisedArms(base: Grid, a: ArmGeometry, hands: number, jacket: boolean): Grid {
  const h = base.length;
  const w = base[0]?.length ?? 0;
  const c: string[][] = Array.from({ length: h }, () => Array.from({ length: w }, () => '.'));
  const cloth = (ch: string): string => (jacket ? (JACKET_SLOTS[ch] ?? ch) : ch);
  for (let y = hands; y <= a.top + 1; y++) {
    const lean = y < hands + 5 ? 1 : 0;
    for (let k = 0; k < a.width; k++) {
      const last = k === a.width - 1;
      let l: string;
      let r: string;
      if (y === hands) {
        l = k === 0 ? '3' : '2';
        r = last ? '1' : '2';
      } else if (y === hands + 1) {
        l = last ? '1' : '2';
        r = last ? '1' : '2';
      } else if (y === hands + 2) {
        l = cloth(last ? 't' : 'u');
        r = cloth(k === 0 || last ? 't' : 'u');
      } else {
        l = cloth(last ? 'u' : 'v');
        r = cloth(last ? 't' : 'u');
      }
      const rowC = c[y];
      if (!rowC) continue;
      rowC[a.left - lean + k] = l;
      rowC[a.right - a.width + 1 + lean + k] = r;
    }
  }
  const marks: [number, number][] = [];
  c.forEach((row, y) =>
    row.forEach((ch, x) => {
      if (ch !== '.' || (base[y]?.charAt(x) ?? '.') !== '.') return;
      if (filled(c[y]?.[x - 1]) || filled(c[y]?.[x + 1]) || filled(c[y - 1]?.[x]) || filled(c[y + 1]?.[x])) marks.push([x, y]);
    }),
  );
  for (const [x, y] of marks) {
    const row = c[y];
    if (row) row[x] = 'o';
  }
  return rows(c);
}

/**
 * Head down: the forearms folded flat across the body, `fill` rows of sleeve
 * between an outline row at `top` and one below, 1 px wider than the body on
 * each side (elbows), the two forearms meeting at a fold in the middle. Drawn
 * over the lowered head, so the face is hidden behind them.
 */
export function flatArms(w: number, h: number, a: ArmGeometry, top: number, fill: number, jacket: boolean): Grid {
  const cloth = (ch: string): string => (jacket ? (JACKET_SLOTS[ch] ?? ch) : ch);
  const x0 = Math.max(1, a.minX - 1);
  const x1 = Math.min(w - 2, a.maxX + 1);
  const mid = w / 2;
  const bottom = top + fill + 1;
  return Array.from({ length: h }, (_, y) =>
    Array.from({ length: w }, (_, x) => {
      if (y < top || y > bottom) return '.';
      const inside = x >= x0 && x <= x1;
      if (y === top || y === bottom) return inside ? 'o' : '.';
      if (x === x0 - 1 || x === x1 + 1) return 'o';
      if (!inside) return '.';
      const row = y - top; // 1..fill
      if (x === mid - 1 || x === x0 || x === x1) return cloth(row === fill ? 't' : 'u'); // fold, elbows
      if (row === fill) return cloth(x >= mid ? 't' : 'u'); // underside
      if (row === 1) return cloth(x > x1 - 3 || x >= mid + 4 ? 'u' : 'v'); // lit top
      return cloth(x >= mid ? 'u' : 'v');
    }).join(''),
  );
}
