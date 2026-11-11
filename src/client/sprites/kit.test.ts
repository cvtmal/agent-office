import { describe, expect, it } from 'vitest';
import type { Grid } from '../render/raster.js';
import { bookRow, box, dither, ellipse, frame, grid, planks, rng, stamp } from './kit.js';

/** Asserts a rectangular grid of the declared size. */
function expectSize(g: Grid, w: number, h: number): void {
  expect(g).toHaveLength(h);
  for (const row of g) expect(row).toHaveLength(w);
}

describe('kit', () => {
  it('rng is deterministic per seed and in [0, 1)', () => {
    const a = rng(7);
    const b = rng(7);
    const xs = Array.from({ length: 50 }, () => a());
    expect(xs).toEqual(Array.from({ length: 50 }, () => b()));
    for (const x of xs) expect(x >= 0 && x < 1).toBe(true);
    expect(rng(8)()).not.toBe(xs[0]);
  });

  it('grid fills every pixel', () => {
    expect(grid(3, 2, (x, y) => String(x + y))).toEqual(['012', '123']);
  });

  it('box: fill, shade rows and outline', () => {
    expect(box(3, 2)).toEqual(['222', '222']);
    expect(box(4, 5, { fill: '2', shadeTop: '3', shadeBottom: '1', outline: 'o' })).toEqual([
      'oooo',
      'o33o',
      'o22o',
      'o11o',
      'oooo',
    ]);
    expect(box(2, 3, { shadeTop: '3', shadeBottom: '1' })).toEqual(['33', '22', '11']);
  });

  it('planks: seam rows every plank height, joints, deterministic', () => {
    const g = planks(16, 16, { plank: 4, seed: 3 });
    expectSize(g, 16, 16);
    for (const y of [3, 7, 11, 15]) expect(g[y]).toBe('1'.repeat(16));
    expect(g[0]).toMatch(/13/);
    expect(new Set(g.join(''))).toEqual(new Set(['1', '2', '3']));
    expect(planks(16, 16, { plank: 4, seed: 3 })).toEqual(g);
    expectSize(planks(40, 10, { plank: 5 }), 40, 10);
  });

  it('bookRow: declared size, spines A-D, neighbours differ, deterministic', () => {
    const g = bookRow(30, 1);
    expectSize(g, 30, 9);
    expect(g[8]).toMatch(/^[ABCD]+$/);
    expect(g.join('')).toMatch(/^[ABCD.]+$/);
    expect(bookRow(30, 1)).toEqual(g);
    expect(bookRow(30, 2)).not.toEqual(g);
    expectSize(bookRow(12, 5, 6), 12, 6);
  });

  it('frame: outline, lit and dark inner ring, transparent inside', () => {
    expect(frame(5, 5)).toEqual(['ooooo', 'o333o', 'o3.1o', 'o311o', 'ooooo']);
  });

  it('dither: checkerboard', () => {
    expect(dither(3, 2, 'a', 'b')).toEqual(['aba', 'bab']);
  });

  it('ellipse: declared size, symmetric, touching the edges', () => {
    const g = ellipse(10, 4, 's');
    expectSize(g, 10, 4);
    expect(g[0]).toMatch(/^\.+s+\.+$/);
    expect(g[1]).toBe('ssssssssss');
    for (const row of g) expect([...row].reverse().join('')).toBe(row);
    expect([...g].reverse()).toEqual(g);
  });

  it('stamp: overwrites with non-dot chars, clipped', () => {
    expect(stamp(['aaa', 'aaa'], ['b.', 'bb'], 2, 1)).toEqual(['aaa', 'aab']);
    expect(stamp(['aaa', 'aaa'], ['b.', 'cb'], -1, -1)).toEqual(['baa', 'aaa']);
  });
});
