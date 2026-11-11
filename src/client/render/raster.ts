// Pure rasteriser: palette-indexed grids -> RGBA pixel buffers, plus the few
// buffer operations sprites need. DOM-free (tested in Node, packed into the
// sprite sheet with putImageData in the browser).
import { rgba } from './palette.js';

/** An RGBA image: `data` is w*h*4 bytes, row-major; alpha is 0 or 255 for sprites. */
export interface Raster {
  w: number;
  h: number;
  data: Uint8ClampedArray;
}

/** A sprite grid: equal-length rows, one char per pixel, `.` = transparent. */
export type Grid = readonly string[];

/** One layer for `compose`: a raster drawn with its top-left at (dx, dy). */
export interface Layer {
  raster: Raster;
  dx: number;
  dy: number;
}

/** A fully transparent w x h raster. */
export function blank(w: number, h: number): Raster {
  return { w, h, data: new Uint8ClampedArray(w * h * 4) };
}

/**
 * Grid -> raster. `key` maps each char to a palette colour name; `recolour`
 * then maps palette name -> palette name (e.g. `rampMap('skinA', 'skinC')`).
 * Throws on ragged rows or an unknown char, naming `id`.
 */
export function rasterize(
  grid: Grid,
  key: Readonly<Record<string, string>>,
  recolour?: Readonly<Record<string, string>>,
  id = 'grid',
): Raster {
  const h = grid.length;
  const w = grid[0]?.length ?? 0;
  const out = blank(w, h);
  const cache = new Map<string, readonly number[]>();
  grid.forEach((row, y) => {
    if (row.length !== w) {
      throw new Error(`${id}: row ${String(y)} has ${String(row.length)} px, expected ${String(w)}`);
    }
    for (let x = 0; x < w; x++) {
      const ch = row.charAt(x);
      if (ch === '.') continue;
      let px = cache.get(ch);
      if (!px) {
        const name = key[ch];
        if (name === undefined) throw new Error(`${id}: unknown char '${ch}' at ${String(x)},${String(y)}`);
        px = rgba(recolour?.[name] ?? name);
        cache.set(ch, px);
      }
      out.data.set(px, (y * w + x) * 4);
    }
  });
  return out;
}

/** Layers drawn in order onto a transparent w x h raster; opaque pixels overwrite, out-of-bounds clipped. */
export function compose(w: number, h: number, layers: readonly Layer[]): Raster {
  const out = blank(w, h);
  for (const layer of layers) blit(out, layer.raster, layer.dx, layer.dy);
  return out;
}

/** Draws `src` onto `dst` at (dx, dy) in place: non-transparent pixels overwrite, clipped. */
export function blit(dst: Raster, src: Raster, dx: number, dy: number): void {
  for (let y = 0; y < src.h; y++) {
    const ty = y + dy;
    if (ty < 0 || ty >= dst.h) continue;
    for (let x = 0; x < src.w; x++) {
      const tx = x + dx;
      if (tx < 0 || tx >= dst.w) continue;
      const s = (y * src.w + x) * 4;
      if ((src.data[s + 3] ?? 0) === 0) continue;
      dst.data.set(src.data.subarray(s, s + 4), (ty * dst.w + tx) * 4);
    }
  }
}

/** The w x h region at (x, y); parts outside `r` come out transparent. */
export function crop(r: Raster, x: number, y: number, w: number, h: number): Raster {
  return compose(w, h, [{ raster: r, dx: -x, dy: -y }]);
}

/** Nearest-neighbour scale by a whole number n >= 1. */
export function scale(r: Raster, n: number): Raster {
  if (!Number.isInteger(n) || n < 1) throw new Error(`scale must be a whole number >= 1, got ${String(n)}`);
  const out = blank(r.w * n, r.h * n);
  for (let y = 0; y < out.h; y++) {
    for (let x = 0; x < out.w; x++) {
      const s = (Math.floor(y / n) * r.w + Math.floor(x / n)) * 4;
      out.data.set(r.data.subarray(s, s + 4), (y * out.w + x) * 4);
    }
  }
  return out;
}

/** Mirror image left <-> right. */
export function flipX(r: Raster): Raster {
  const out = blank(r.w, r.h);
  for (let y = 0; y < r.h; y++) {
    for (let x = 0; x < r.w; x++) {
      const s = (y * r.w + x) * 4;
      out.data.set(r.data.subarray(s, s + 4), (y * r.w + (r.w - 1 - x)) * 4);
    }
  }
  return out;
}

/**
 * Moves rows [fromRow, toRow) down by dy (up if negative), e.g. the upper body for
 * breathing. The band is cleared first; moved pixels then overwrite where opaque.
 */
export function shiftRows(r: Raster, fromRow: number, toRow: number, dy: number): Raster {
  const out: Raster = { w: r.w, h: r.h, data: new Uint8ClampedArray(r.data) };
  const from = Math.max(0, fromRow);
  const to = Math.min(r.h, toRow);
  if (to <= from) return out;
  out.data.fill(0, from * r.w * 4, to * r.w * 4);
  blit(out, crop(r, 0, from, r.w, to - from), 0, from + dy);
  return out;
}
