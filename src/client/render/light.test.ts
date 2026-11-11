import { describe, expect, it } from 'vitest';
import { lightKey, lightRaster, type LightTheme, type LitLamp } from './light.js';
import { rgba } from './palette.js';
import type { Raster } from './raster.js';

const THEME: LightTheme = { nightTint: 'night3', lampTint: 'lamp1' };

function px(r: Raster, x: number, y: number): number[] {
  const i = (y * r.w + x) * 4;
  return Array.from(r.data.subarray(i, i + 4));
}

function colours(r: Raster, x0: number, y0: number, x1: number, y1: number): Set<string> {
  const out = new Set<string>();
  for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) out.add(px(r, x, y).join(','));
  return out;
}

const lum = (p: number[]): number => (p[0] ?? 0) + (p[1] ?? 0) + (p[2] ?? 0);

describe('lightRaster', () => {
  it('without lit lamps is the night tint everywhere, and the screen layer is clear', () => {
    const { multiply, screen } = lightRaster([], THEME);
    expect(multiply.w).toBe(480);
    expect(multiply.h).toBe(270);
    expect(colours(multiply, 0, 0, 479, 269)).toEqual(new Set([rgba('night3').join(',')]));
    expect(screen.data.every((b) => b === 0)).toBe(true);
  });

  it('a lit lamp brightens its pool; an off lamp (absent) leaves the tint', () => {
    const lamp: LitLamp = { id: 'lamp:A-lead', x: 100, y: 100 };
    const lit = lightRaster([lamp], THEME).multiply;
    const tint = rgba('night3') as readonly number[];
    expect(lum(px(lit, 100, 108))).toBeGreaterThan(lum([...tint]));
    expect(px(lit, 300, 200)).toEqual([...tint]);
  });

  it('band edges are hard: at most 3 distinct colours inside one pool besides the tint', () => {
    const { multiply } = lightRaster([{ id: 'lamp:A-lead', x: 200, y: 120 }], THEME);
    const inPool = colours(multiply, 150, 90, 250, 160);
    inPool.delete(rgba('night3').join(','));
    expect(inPool.size).toBeLessThanOrEqual(3);
    expect(inPool.size).toBeGreaterThanOrEqual(2);
  });

  it('bands get warmer towards the centre: night4, cream, then the theme lamp tint', () => {
    const { multiply } = lightRaster([{ id: 'lamp:A-lead', x: 200, y: 120 }], THEME);
    const row = new Set<string>();
    for (let x = 140; x <= 200; x++) row.add(px(multiply, x, 128).join(','));
    expect([...row]).toEqual([rgba('night3'), rgba('night4'), rgba('lamp2'), rgba('lamp1')].map((c) => c.join(',')));
  });

  it('every band of a pool is brighter than the tint', () => {
    const { multiply } = lightRaster([{ id: 'lamp:A-lead', x: 200, y: 120 }], THEME);
    const tint = lum([...rgba('night3')]);
    for (let x = 160; x <= 200; x++) expect(lum(px(multiply, x, 128))).toBeGreaterThan(tint);
  });

  it('overlapping pools merge (the inner band is never overwritten by a neighbour)', () => {
    const a = lightRaster([{ id: 'lamp:a', x: 200, y: 120 }], THEME).multiply;
    const ab = lightRaster(
      [
        { id: 'lamp:a', x: 200, y: 120 },
        { id: 'lamp:b', x: 230, y: 120 },
      ],
      THEME,
    ).multiply;
    expect(px(ab, 200, 128)).toEqual(px(a, 200, 128));
  });

  it('puts lamp cores on the screen layer', () => {
    const { screen } = lightRaster([{ id: 'lamp:x', x: 50, y: 50 }], THEME);
    expect(px(screen, 50, 50)).toEqual([...rgba('lamp1')]);
    expect(px(screen, 70, 50)).toEqual([0, 0, 0, 0]);
  });

  it('lights the window glass as a hard rectangle (moon), leaving the wall around it tinted', () => {
    const { multiply, screen } = lightRaster([{ id: 'moon:window', x: 56, y: 52 }], THEME);
    expect(colours(multiply, 20, 32, 91, 71)).toEqual(new Set([rgba('night4').join(',')]));
    for (const [x, y] of [
      [19, 52],
      [92, 52],
      [56, 31],
      [56, 72],
    ] as const) {
      expect(px(multiply, x, y), `${String(x)},${String(y)}`).toEqual([...rgba('night3')]);
    }
    expect(screen.data.every((b) => b === 0)).toBe(true);
  });

  it('tints a neon pool with its own colours; fairy lights lift the wall to night4', () => {
    const { multiply, screen } = lightRaster(
      [
        { id: 'neon:sign', x: 300, y: 100 },
        { id: 'neon:fairy', x: 100, y: 100 },
      ],
      THEME,
    );
    expect(px(multiply, 300, 100)).toEqual([...rgba('neon0')]);
    expect(px(multiply, 300 + 24, 100)).toEqual([...rgba('magenta1')]);
    expect(px(screen, 300, 100)).toEqual([...rgba('magenta0', 120)]);
    expect(px(multiply, 100, 101)).toEqual([...rgba('night4')]);
  });

  it('is deterministic for the same input', () => {
    const lamps: LitLamp[] = [
      { id: 'moon:window', x: 56, y: 52 },
      { id: 'glow:cto', x: 34, y: 130 },
      { id: 'lamp:coffee', x: 390, y: 60 },
    ];
    const a = lightRaster(lamps, THEME);
    const b = lightRaster(lamps, THEME);
    expect(a.multiply.data).toEqual(b.multiply.data);
    expect(a.screen.data).toEqual(b.screen.data);
    expect(lightKey(lamps, THEME)).toBe(lightKey([...lamps].reverse(), THEME));
    expect(lightKey(lamps, THEME)).not.toBe(lightKey(lamps.slice(1), THEME));
  });
});
