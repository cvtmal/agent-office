// Sprite family `shell` (plan step 3.2): the fixed parts of the back wall —
// the night window of the CTO office, the door and the wall trim. Drawn on a
// small char canvas so each element (sky band, star, building, lit window,
// panel) is one readable call. Everything here is original (scope P-6). DOM-free.
import { grid, rng } from '../kit.js';
import type { Family, Grid, SpriteDef } from '../types.js';

/** A mutable w x h char canvas, transparent (`.`) at start. */
class Canvas {
  private readonly px: string[][];

  constructor(
    readonly w: number,
    readonly h: number,
  ) {
    this.px = Array.from({ length: h }, () => Array.from({ length: w }, () => '.'));
  }

  /** Sets one pixel; outside the canvas is ignored. */
  set(x: number, y: number, ch: string): void {
    const row = this.px[y];
    if (row && x >= 0 && x < this.w) row[x] = ch;
  }

  /** The char at (x, y), `.` outside. */
  get(x: number, y: number): string {
    return this.px[y]?.[x] ?? '.';
  }

  /** Fills the rectangle [x, x+w) x [y, y+h). */
  rect(x: number, y: number, w: number, h: number, ch: string): void {
    for (let j = y; j < y + h; j++) for (let i = x; i < x + w; i++) this.set(i, j, ch);
  }

  /** The canvas as a grid. */
  grid(): Grid {
    return this.px.map((row) => row.join(''));
  }
}

/**
 * Night window, 80x48: a wooden frame with a lit top-left edge and a shaded
 * bottom-right edge, a cross of mullions (2x2 panes), a sill, and behind the glass
 * a dusk sky (deep purple at the top through dithered steps to a blue haze),
 * stars, a moon and a generic original skyline of flat roofs, a water tower and
 * an antenna, with a few warm windows still lit.
 */
function windowNight(): Grid {
  const W = 80;
  const H = 48;
  const c = new Canvas(W, H);
  // Sky: bands from the top (z = night0, y = night1, b = blue0, v = night2). Each band
  // has a base and an accent char mixed in at a density: 0 none, 1 sparse (1 in 4,
  // staggered), 2 half (checker): one or two mixed rows per step, never a wide checker stripe.
  const bands: [from: number, base: string, accent: string, density: 0 | 1 | 2][] = [
    [0, 'z', 'z', 0],
    [3, 'z', 'y', 2],
    [4, 'y', 'z', 1],
    [5, 'y', 'y', 0],
    [15, 'y', 'b', 1],
    [16, 'y', 'b', 2],
    [17, 'b', 'y', 1],
    [18, 'b', 'b', 0],
    [33, 'b', 'v', 2],
    [34, 'v', 'v', 0],
  ];
  for (let y = 0; y < H; y++) {
    const [, base, accent, density] = [...bands].reverse().find(([from]) => y >= from) ?? [0, 'z', 'z', 0];
    for (let x = 0; x < W; x++) {
      const mix = density === 2 ? (x + y) % 2 === 0 : density === 1 && (x + 2 * (y % 2)) % 4 === 0;
      c.set(x, y, mix ? accent : base);
    }
  }
  // Stars: bright (s) and dim (d), only in the upper sky; one four-point twinkle.
  const r = rng(2026);
  for (let i = 0; i < 26; i++) {
    const x = 4 + Math.floor(r() * (W - 8));
    const y = 4 + Math.floor(r() * 24);
    c.set(x, y, r() < 0.4 ? 's' : 'd');
  }
  for (const [dx, dy] of [
    [0, -1],
    [-1, 0],
    [1, 0],
    [0, 1],
  ] as const) {
    c.set(17 + dx, 11 + dy, 'd');
  }
  c.set(17, 11, 's');
  // Moon (upper-right pane): disc with a lit core, shaded lower-right rim, two craters.
  const mx = 60;
  const my = 12;
  for (let y = -5; y <= 5; y++) {
    for (let x = -5; x <= 5; x++) {
      const d = x * x + y * y;
      if (d > 26) continue;
      const shade = x + y >= 5 || d > 20 ? 'M' : 'm';
      c.set(mx + x, my + y, shade);
    }
  }
  c.set(mx - 2, my - 1, 'M');
  c.set(mx + 1, my + 2, 'M');
  c.set(mx + 2, my + 2, 'M');
  // Skyline: buildings (k) from the bottom of the glass; lit windows w/W on a 2-px grid.
  const glassBottom = 41;
  const buildings: [number, number, number][] = [
    // [x, width, height]
    [3, 9, 11],
    [12, 6, 17],
    [18, 10, 8],
    [28, 7, 14],
    [35, 12, 20],
    [47, 6, 10],
    [53, 9, 15],
    [62, 5, 9],
    [67, 11, 13],
  ];
  const lit = rng(77);
  for (const [bx, bw, bh] of buildings) {
    const top = glassBottom - bh;
    c.rect(bx, top, bw, bh, 'k');
    // Lit roof edge (moonlight from the upper right is too far; keep a dim top line).
    c.rect(bx, top, bw, 1, 'K');
    for (let y = top + 2; y < glassBottom - 1; y += 3) {
      for (let x = bx + 1; x < bx + bw - 1; x += 2) {
        const v = lit();
        if (v < 0.16) c.set(x, y, 'W');
        else if (v < 0.24) c.set(x, y, 'w');
      }
    }
  }
  // Water tower on the 12..17 building, antenna with a red light on the tall one.
  c.rect(13, glassBottom - 17 - 4, 4, 3, 'k');
  c.set(13, glassBottom - 17 - 1, 'k');
  c.set(16, glassBottom - 17 - 1, 'k');
  c.rect(13, glassBottom - 17 - 5, 4, 1, 'K');
  c.rect(41, glassBottom - 20 - 6, 1, 6, 'k');
  c.set(41, glassBottom - 20 - 7, 'R');
  // Frame: outline, lit top/left, shaded bottom/right, 3 px; mullions 2 px; sill.
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const edge = Math.min(x, y, W - 1 - x, H - 5 - y);
      if (y >= H - 4) continue;
      if (edge === 0) c.set(x, y, 'o');
      else if (edge === 1) c.set(x, y, x === 1 || y === 1 ? '3' : x >= W - 2 || y >= H - 6 ? '1' : '2');
      else if (edge === 2) c.set(x, y, x === W - 3 || y === H - 7 ? 'o' : x === 2 || y === 2 ? 'o' : c.get(x, y));
    }
  }
  // Mullions: vertical at x 39-40, horizontal at y 21-22 (lit left/top, shaded right/bottom).
  for (let y = 3; y < H - 7; y++) {
    c.set(39, y, '3');
    c.set(40, y, '1');
  }
  for (let x = 3; x < W - 3; x++) {
    c.set(x, 21, '3');
    c.set(x, 22, '1');
  }
  c.set(39, 21, '3');
  c.set(40, 22, '1');
  // Sill: outline, lit top, body, outline.
  for (let x = 0; x < W; x++) {
    c.set(x, H - 4, x === 0 || x === W - 1 ? 'o' : '3');
    c.set(x, H - 3, x === 0 || x === W - 1 ? 'o' : '2');
    c.set(x, H - 2, x === 0 || x === W - 1 ? 'o' : '1');
    c.set(x, H - 1, 'o');
  }
  return c.grid();
}

/**
 * Door, 32x56: a casing (outline, lit left/top, shaded right), a slab with four
 * bevelled panels (lit top-left, shaded bottom-right), a brass knob with a lit
 * top-left pixel, a pinned note and a threshold.
 */
function door(): Grid {
  const W = 32;
  const H = 56;
  const c = new Canvas(W, H);
  // Casing.
  c.rect(0, 0, W, H, 'o');
  c.rect(1, 1, W - 2, H - 1, '2');
  c.rect(1, 1, 1, H - 1, '3');
  c.rect(1, 1, W - 2, 1, '3');
  c.rect(W - 2, 2, 1, H - 2, '1');
  // Slab.
  c.rect(4, 4, W - 8, H - 4, 'o');
  c.rect(5, 5, W - 10, H - 5, 'B');
  c.rect(5, 5, 1, H - 5, 'L');
  c.rect(5, 5, W - 10, 1, 'L');
  c.rect(W - 6, 6, 1, H - 6, 'S');
  // Panels: two columns, upper (tall) and lower.
  for (const [px, py, pw, ph] of [
    [8, 8, 7, 18],
    [17, 8, 7, 18],
    [8, 30, 7, 20],
    [17, 30, 7, 20],
  ] as const) {
    c.rect(px, py, pw, ph, 'S');
    c.rect(px + 1, py + 1, pw - 1, ph - 1, 'L');
    c.rect(px + 1, py + 1, pw - 2, ph - 2, 'B');
    c.rect(px + 2, py + ph - 2, pw - 2, 1, 'S');
  }
  // Knob (left side, so the door opens away from the CTO's glass).
  c.rect(7, 28, 3, 3, 'o');
  c.set(8, 29, 'K');
  c.set(8, 28, 'k');
  c.set(7, 29, 'k');
  c.set(9, 30, 'o');
  // Note pinned to the upper right panel.
  c.rect(18, 11, 5, 6, 'n');
  c.rect(18, 16, 5, 1, 'N');
  c.rect(19, 13, 3, 1, 'N');
  c.set(20, 11, 'p');
  // Threshold.
  c.rect(4, H - 1, W - 8, 1, 'o');
  return c.grid();
}

/** Wall trim (picture rail), 16x4: outline, lit top, body, shade; tiles horizontally. */
function wallTrim(): Grid {
  return grid(16, 4, (x, y) => {
    if (y === 0) return 'o';
    if (y === 1) return '3';
    if (y === 2) return x === 9 ? '1' : '2';
    return '1';
  });
}

const WOOD = { o: 'wood0', '1': 'wood1', '2': 'wood2', '3': 'wood3' };

const SPRITES: SpriteDef[] = [
  {
    id: 'window-night',
    w: 80,
    h: 48,
    grid: windowNight(),
    key: {
      ...WOOD,
      z: 'night0',
      y: 'night1',
      b: 'blue0',
      v: 'night2',
      s: 'lamp2',
      d: 'night4',
      m: 'lamp2',
      M: 'lamp1',
      k: 'night0',
      K: 'night2',
      w: 'lamp0',
      W: 'lamp1',
      R: 'orange1',
    },
  },
  {
    id: 'door',
    w: 32,
    h: 56,
    grid: door(),
    key: {
      ...WOOD,
      B: 'wood1',
      L: 'wood2',
      S: 'wood0',
      k: 'lamp1',
      K: 'lamp2',
      n: 'lamp2',
      N: 'night4',
      p: 'magenta1',
    },
  },
  { id: 'wall-trim', w: 16, h: 4, grid: wallTrim(), key: WOOD },
];

/** The `shell` family; preview sheet `var/sprites/shell.png`. */
export const shellFamily: Family = { name: 'shell', sprites: SPRITES };
