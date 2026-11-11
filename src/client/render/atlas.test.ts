import { describe, expect, it } from 'vitest';
import { ShelfPacker, type Place } from './atlas.js';

interface Box extends Place {
  w: number;
  h: number;
}

function overlaps(a: Box, b: Box): boolean {
  return a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h;
}

describe('ShelfPacker', () => {
  it('packs left to right, then opens a shelf below', () => {
    const p = new ShelfPacker(64, 64);
    expect(p.place(32, 16)).toEqual({ x: 0, y: 0 });
    expect(p.place(32, 16)).toEqual({ x: 32, y: 0 });
    expect(p.place(16, 16)).toEqual({ x: 0, y: 16 });
  });

  it('puts a short sprite on an existing taller shelf with room', () => {
    const p = new ShelfPacker(64, 64);
    p.place(16, 48);
    expect(p.place(16, 16)).toEqual({ x: 16, y: 0 });
  });

  it('never overlaps and stays inside the sheet', () => {
    const p = new ShelfPacker(256, 256);
    const boxes: Box[] = [];
    const sizes: [number, number][] = [
      [32, 48],
      [16, 16],
      [80, 48],
      [24, 36],
      [16, 4],
      [112, 64],
      [14, 12],
    ];
    for (let i = 0; i < 40; i++) {
      const [w, h] = sizes[i % sizes.length] ?? [1, 1];
      const at = p.place(w, h);
      if (at === null) break;
      boxes.push({ ...at, w, h });
    }
    expect(boxes.length).toBeGreaterThan(10);
    for (const b of boxes) {
      expect(b.x).toBeGreaterThanOrEqual(0);
      expect(b.y).toBeGreaterThanOrEqual(0);
      expect(b.x + b.w).toBeLessThanOrEqual(256);
      expect(b.y + b.h).toBeLessThanOrEqual(256);
    }
    boxes.forEach((a, i) => {
      for (const b of boxes.slice(i + 1)) expect(overlaps(a, b)).toBe(false);
    });
  });

  it('returns null when full or too large', () => {
    const p = new ShelfPacker(32, 32);
    expect(p.place(33, 1)).toBeNull();
    expect(p.place(1, 33)).toBeNull();
    expect(p.place(32, 32)).toEqual({ x: 0, y: 0 });
    expect(p.place(1, 1)).toBeNull();
  });
});
