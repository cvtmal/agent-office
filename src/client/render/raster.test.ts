import { describe, expect, it } from 'vitest';
import { rgba } from './palette.js';
import { blank, compose, crop, flipX, rasterize, scale, shiftRows, type Raster } from './raster.js';

const KEY = { a: 'night0', b: 'lamp2', c: 'wood2' };

/** RGBA bytes at (x, y). */
function px(r: Raster, x: number, y: number): number[] {
  const i = (y * r.w + x) * 4;
  return [...r.data.subarray(i, i + 4)];
}

/** One char per pixel back from a raster built with KEY ('.' for transparent). */
function chars(r: Raster): string[] {
  const back = new Map(Object.entries(KEY).map(([ch, name]) => [rgba(name).join(), ch]));
  const rows: string[] = [];
  for (let y = 0; y < r.h; y++) {
    let row = '';
    for (let x = 0; x < r.w; x++) {
      const p = px(r, x, y);
      row += p[3] === 0 ? '.' : (back.get(p.join()) ?? '?');
    }
    rows.push(row);
  }
  return rows;
}

const r = (grid: string[]): Raster => rasterize(grid, KEY);

describe('rasterize', () => {
  it('maps chars to palette colours and dots to transparency', () => {
    const out = r(['a.', '.b']);
    expect(out.w).toBe(2);
    expect(out.h).toBe(2);
    expect(px(out, 0, 0)).toEqual([...rgba('night0')]);
    expect(px(out, 1, 0)).toEqual([0, 0, 0, 0]);
    expect(px(out, 1, 1)).toEqual([...rgba('lamp2')]);
  });

  it('recolours palette names', () => {
    const out = rasterize(['ab'], KEY, { night0: 'wood2' });
    expect(chars(out)).toEqual(['cb']);
  });

  it('throws on an unknown char or ragged rows, naming the sprite', () => {
    expect(() => rasterize(['ax'], KEY, undefined, 'desk')).toThrow(/desk.*'x'/);
    expect(() => rasterize(['aa', 'a'], KEY, undefined, 'desk')).toThrow(/desk.*row 1/);
  });
});

describe('compose', () => {
  it('draws layers in order, skipping transparent pixels, clipping at the edges', () => {
    const out = compose(3, 2, [
      { raster: r(['aaa', 'aaa']), dx: 0, dy: 0 },
      { raster: r(['b.', 'bb']), dx: 1, dy: 0 },
      { raster: r(['cc']), dx: 2, dy: 1 },
      { raster: r(['cc']), dx: -1, dy: -1 },
    ]);
    expect(chars(out)).toEqual(['aba', 'abc']);
  });
});

describe('crop, scale, flipX', () => {
  const src = r(['abc', 'cba']);

  it('crops a region, transparent outside', () => {
    expect(chars(crop(src, 1, 0, 3, 2))).toEqual(['bc.', 'ba.']);
  });

  it('scales by whole numbers only', () => {
    expect(chars(scale(r(['ab']), 2))).toEqual(['aabb', 'aabb']);
    expect(() => scale(src, 1.5)).toThrow();
    expect(() => scale(src, 0)).toThrow();
  });

  it('mirrors horizontally', () => {
    expect(chars(flipX(src))).toEqual(['cba', 'abc']);
  });

  it('blank is transparent', () => {
    expect(chars(blank(2, 1))).toEqual(['..']);
  });
});

describe('shiftRows', () => {
  const body = r(['aa', 'bb', 'cc', 'cc']);

  it('moves a band down, clearing what it leaves', () => {
    expect(chars(shiftRows(body, 0, 2, 1))).toEqual(['..', 'aa', 'bb', 'cc']);
  });

  it('keeps rows outside the band and does not mutate the input', () => {
    expect(chars(shiftRows(body, 2, 4, -1))).toEqual(['aa', 'cc', 'cc', '..']);
    expect(chars(body)).toEqual(['aa', 'bb', 'cc', 'cc']);
  });

  it('is a copy for an empty band', () => {
    expect(chars(shiftRows(body, 3, 3, 1))).toEqual(chars(body));
  });
});
