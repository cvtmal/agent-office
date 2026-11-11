// Procedural helpers that return grids (plan step 1.6), so sprites need not be
// typed out pixel by pixel. Char convention (research Q3): `o` outline, `1`/`2`/`3`
// dark/base/light tone of the part's ramp, `.` transparent; the sprite's `key`
// maps the chars to palette names. DOM-free.
import type { Grid } from '../render/raster.js';

/** Options for `box`: chars for the fill, the top/bottom shade rows and the outline ring; omitted = none. */
export interface BoxOptions {
  fill?: string;
  shadeTop?: string;
  shadeBottom?: string;
  outline?: string;
}

/** Options for `planks`: body, seam (bottom row + joints) and light (lit edge after a joint) chars, plank height, seed. */
export interface PlankOptions {
  fill?: string;
  seam?: string;
  light?: string;
  plank?: number;
  seed?: number;
}

/** Options for `frame`: outline ring, lit (top/left) and dark (bottom/right) chars of the inner ring. */
export interface FrameOptions {
  outline?: string;
  light?: string;
  dark?: string;
}

/** Deterministic pseudo-random numbers in [0, 1) from a seed (mulberry32). */
export function rng(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** A w x h grid with `charAt(x, y)` at every pixel. */
export function grid(w: number, h: number, charAt: (x: number, y: number) => string): Grid {
  return Array.from({ length: h }, (_, y) => Array.from({ length: w }, (_, x) => charAt(x, y)).join(''));
}

/** Filled rectangle, optionally with a top (lit) and bottom (shaded) row and an outline ring. */
export function box(w: number, h: number, opts: BoxOptions = {}): Grid {
  const { fill = '2', shadeTop, shadeBottom, outline } = opts;
  const inset = outline === undefined ? 0 : 1;
  return grid(w, h, (x, y) => {
    if (outline !== undefined && (x === 0 || y === 0 || x === w - 1 || y === h - 1)) return outline;
    if (shadeTop !== undefined && y === inset) return shadeTop;
    if (shadeBottom !== undefined && y === h - 1 - inset) return shadeBottom;
    return fill;
  });
}

/** Horizontal planks `plank` rows tall with a seam row below each and staggered joints (floors, shelves, desk tops). */
export function planks(w: number, h: number, opts: PlankOptions = {}): Grid {
  const { fill = '2', seam = '1', light = '3', plank = 4, seed = 0 } = opts;
  const bandStarts = Array.from({ length: Math.ceil(h / plank) }, (_, band) => {
    const r = rng(seed * 31 + band);
    return Math.floor(r() * 16);
  });
  return grid(w, h, (x, y) => {
    if (y % plank === plank - 1) return seam;
    const joint = bandStarts[Math.floor(y / plank)] ?? 0;
    const col = (x - joint + 16 * w) % 16;
    if (col === 0) return seam;
    if (col === 1) return light;
    return fill;
  });
}

/** A shelf row of standing books, 2-3 px wide, varying heights up to `h`; spines `A`-`D`, neighbours differ. */
export function bookRow(w: number, seed: number, h = 9): Grid {
  const r = rng(seed);
  const cols: { ch: string; top: number }[] = [];
  let prev = '';
  while (cols.length < w) {
    const width = 2 + Math.floor(r() * 2);
    const top = Math.floor(r() * 4);
    const options = ['A', 'B', 'C', 'D'].filter((c) => c !== prev);
    const ch = options[Math.floor(r() * options.length)] ?? 'A';
    prev = ch;
    for (let i = 0; i < width && cols.length < w; i++) cols.push({ ch, top });
  }
  return grid(w, h, (x, y) => {
    const c = cols[x];
    return c && y >= c.top ? c.ch : '.';
  });
}

/** A picture frame: outline ring, lit top/left and dark bottom/right inner ring, transparent inside. */
export function frame(w: number, h: number, opts: FrameOptions = {}): Grid {
  const { outline = 'o', light = '3', dark = '1' } = opts;
  return grid(w, h, (x, y) => {
    if (x === 0 || y === 0 || x === w - 1 || y === h - 1) return outline;
    if (x === 1 || y === 1) return light;
    if (x === w - 2 || y === h - 2) return dark;
    return '.';
  });
}

/** Checkerboard of `a` and `b`, `a` at the top-left (soft blends, rugs, carpet). */
export function dither(w: number, h: number, a: string, b: string): Grid {
  return grid(w, h, (x, y) => ((x + y) % 2 === 0 ? a : b));
}

/** Filled ellipse of `ch` touching all four edges, transparent outside (the foot shadow). */
export function ellipse(w: number, h: number, ch: string): Grid {
  return grid(w, h, (x, y) => {
    const nx = (x + 0.5 - w / 2) / (w / 2);
    const ny = (y + 0.5 - h / 2) / (h / 2);
    return nx * nx + ny * ny <= 1 ? ch : '.';
  });
}

/** `top` drawn onto a copy of `base` at (dx, dy): its non-`.` chars overwrite, clipped to `base`. */
export function stamp(base: Grid, top: Grid, dx: number, dy: number): Grid {
  return base.map((row, y) => {
    const t = top[y - dy];
    if (t === undefined) return row;
    return [...row].map((ch, x) => {
      const c = t.charAt(x - dx);
      return c === '' || c === '.' ? ch : c;
    }).join('');
  });
}
