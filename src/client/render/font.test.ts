import { describe, expect, it } from 'vitest';
import { rgba } from './palette.js';
import { CAP_HEIGHT, GLYPHS, GLYPH_ROWS, TRACKING, glyph, measure, textRaster } from './font.js';

const ASCII = Array.from({ length: 95 }, (_, i) => String.fromCharCode(32 + i));

/** Pixel (x, y) of a raster as RGBA bytes. */
function px(r: { w: number; data: Uint8ClampedArray }, x: number, y: number): number[] {
  const i = (y * r.w + x) * 4;
  return [...r.data.subarray(i, i + 4)];
}

describe('font glyphs', () => {
  it('covers printable ASCII 32-126 plus the ellipsis: 96 glyphs', () => {
    expect(GLYPHS.size).toBe(96);
    for (const ch of [...ASCII, '…']) expect(GLYPHS.has(ch), ch).toBe(true);
  });

  it('gives every glyph 7 rows of its own width, only # and .', () => {
    expect(GLYPH_ROWS).toBe(7);
    for (const [ch, g] of GLYPHS) {
      expect(g.rows, ch).toHaveLength(7);
      expect(g.w, ch).toBeGreaterThan(0);
      for (const row of g.rows) expect(row, ch).toMatch(new RegExp(`^[#.]{${String(g.w)}}$`));
    }
  });

  it('keeps capitals and digits inside the cap height, ink only in the descender for g j p q y , _', () => {
    const descends = new Set(['g', 'j', 'p', 'q', 'y', ',', '_']);
    for (const [ch, g] of GLYPHS) {
      const inkBelow = g.rows.slice(CAP_HEIGHT).some((row) => row.includes('#'));
      expect(inkBelow, ch).toBe(descends.has(ch));
    }
  });

  it('draws ink in every glyph except the space', () => {
    for (const [ch, g] of GLYPHS) expect(g.rows.some((row) => row.includes('#')), ch).toBe(ch !== ' ');
  });

  it('falls back to ? for unknown characters', () => {
    expect(glyph('é')).toBe(GLYPHS.get('?'));
    expect(measure('é')).toBe(measure('?'));
    expect(measure('a\u{1F600}b')).toBe(measure('a?b'));
  });
});

describe('measure', () => {
  it('sums widths plus 1 px tracking between glyphs', () => {
    expect(measure('')).toBe(0);
    expect(measure('i')).toBe(glyph('i').w);
    expect(measure('ab')).toBe(glyph('a').w + TRACKING + glyph('b').w);
  });

  it('fits the name tags of the plan', () => {
    expect(measure('c03-implement')).toBeLessThanOrEqual(56);
    expect(measure('explore-im…')).toBeLessThanOrEqual(56);
  });
});

describe('textRaster', () => {
  it('is measure x 7, ink in fg, transparent elsewhere', () => {
    const r = textRaster('i.', 'lamp2');
    expect(r.w).toBe(measure('i.'));
    expect(r.h).toBe(7);
    expect(px(r, 0, 0)).toEqual([...rgba('lamp2')]);
    expect(px(r, 0, 1)).toEqual([0, 0, 0, 0]);
    expect(px(r, 1, 4)).toEqual([0, 0, 0, 0]); // tracking column
    expect(px(r, 2, 4)).toEqual([...rgba('lamp2')]);
  });

  it('fills the background with bg when given', () => {
    const r = textRaster('i', 'lamp2', 'night1');
    expect(px(r, 0, 1)).toEqual([...rgba('night1')]);
    expect(px(r, 0, 6)).toEqual([...rgba('night1')]);
  });

  it('returns an empty raster for empty text', () => {
    const r = textRaster('', 'lamp2');
    expect([r.w, r.h]).toEqual([0, 7]);
  });
});

describe('legibility', () => {
  it('draws no two characters alike', () => {
    const seen = new Map<string, string>();
    for (const [ch, g] of GLYPHS) {
      const key = g.rows.join('/');
      expect(seen.get(key), `${ch} looks like ${seen.get(key) ?? ''}`).toBeUndefined();
      seen.set(key, ch);
    }
  });
});
