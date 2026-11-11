// The sprite sheet (S2, plan step 5.1): every sprite and composed look is packed once
// into one canvas and drawn from there with integer `drawImage`. The shelf packer is
// pure (tested in Node); `createAtlas` is the DOM half.
import type { Raster } from './raster.js';

/** Top-left of a placed rectangle. */
export interface Place {
  x: number;
  y: number;
}

interface Shelf {
  y: number;
  h: number;
  /** Next free x on this shelf. */
  x: number;
}

/**
 * Shelf packer for a `w` x `h` sheet: rectangles go left to right onto horizontal
 * shelves; a new shelf opens below the last one when none fits. Pure.
 */
export class ShelfPacker {
  readonly w: number;
  readonly h: number;
  private readonly shelves: Shelf[] = [];
  private bottom = 0;

  constructor(w: number, h: number) {
    this.w = w;
    this.h = h;
  }

  /** Reserves a `w` x `h` rectangle; null when the sheet has no room left for it. */
  place(w: number, h: number): Place | null {
    if (w <= 0 || h <= 0 || w > this.w || h > this.h) return null;
    // Best fit: the lowest shelf that is tall enough and has room.
    let best: Shelf | undefined;
    for (const s of this.shelves) {
      if (s.h >= h && this.w - s.x >= w && (best === undefined || s.h < best.h)) best = s;
    }
    if (best === undefined) {
      if (this.bottom + h > this.h) return null;
      best = { y: this.bottom, h, x: 0 };
      this.shelves.push(best);
      this.bottom += h;
    }
    const at = { x: best.x, y: best.y };
    best.x += w;
    return at;
  }
}

/** The sprite sheet: add rasters by id, draw them by id. */
export interface Atlas {
  /** Packs `raster` under `id` (no-op if `id` is already present). */
  add(id: string, raster: Raster): void;
  has(id: string): boolean;
  /** Draws sprite `id` with its top-left at integer (x, y); false if `id` is unknown. */
  draw(ctx: CanvasRenderingContext2D, id: string, x: number, y: number): boolean;
  /** Current sheet size in px (square). */
  readonly size: number;
}

interface Entry {
  raster: Raster;
  x: number;
  y: number;
}

/** A canvas sprite sheet of `size` x `size`; when full it rebuilds itself at twice the size. */
export function createAtlas(size = 1024): Atlas {
  const entries = new Map<string, Entry>();
  let sheetSize = size;
  let packer = new ShelfPacker(sheetSize, sheetSize);
  const canvas = document.createElement('canvas');
  let ctx = sheet(canvas, sheetSize);

  const put = (e: Entry): void => {
    ctx.putImageData(new ImageData(new Uint8ClampedArray(e.raster.data), e.raster.w, e.raster.h), e.x, e.y);
  };

  const grow = (): void => {
    sheetSize *= 2;
    packer = new ShelfPacker(sheetSize, sheetSize);
    ctx = sheet(canvas, sheetSize);
    for (const e of entries.values()) {
      const at = packer.place(e.raster.w, e.raster.h);
      if (at === null) throw new Error('atlas: rebuild ran out of room');
      e.x = at.x;
      e.y = at.y;
      put(e);
    }
  };

  return {
    add(id, raster) {
      if (entries.has(id)) return;
      if (raster.w > 4096 || raster.h > 4096) throw new Error(`atlas: ${id} is too large`);
      let at = packer.place(raster.w, raster.h);
      while (at === null) {
        grow();
        at = packer.place(raster.w, raster.h);
      }
      const e: Entry = { raster, x: at.x, y: at.y };
      entries.set(id, e);
      put(e);
    },
    has: (id) => entries.has(id),
    draw(target, id, x, y) {
      const e = entries.get(id);
      if (e === undefined) return false;
      const { w, h } = e.raster;
      target.drawImage(canvas, e.x, e.y, w, h, Math.round(x), Math.round(y), w, h);
      return true;
    },
    get size() {
      return sheetSize;
    },
  };
}

/** Resizes the sheet canvas (which clears it) and returns its context. */
function sheet(canvas: HTMLCanvasElement, size: number): CanvasRenderingContext2D {
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d', { willReadFrequently: false });
  if (ctx === null) throw new Error('atlas: no 2d context');
  ctx.imageSmoothingEnabled = false;
  return ctx;
}
