import { describe, expect, it } from 'vitest';
import { PALETTE, RAMPS, colour, ramp, rampMap, rgba, type RampName } from './palette.js';

/** Relative luminance (sRGB, WCAG formula) of a palette colour. */
function luminance(name: string): number {
  const [r, g, b] = rgba(name).map((v) => {
    const c = v / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  }) as [number, number, number, number];
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

describe('palette', () => {
  const names = Object.keys(PALETTE);

  it('has 28-40 colours, all distinct #rrggbb', () => {
    expect(names.length).toBeGreaterThanOrEqual(28);
    expect(names.length).toBeLessThanOrEqual(40);
    const hexes = Object.values(PALETTE);
    for (const hex of hexes) expect(hex).toMatch(/^#[0-9a-f]{6}$/);
    expect(new Set(hexes).size).toBe(hexes.length);
  });

  it('has no pure black or white', () => {
    expect(Object.values(PALETTE)).not.toContain('#000000');
    expect(Object.values(PALETTE)).not.toContain('#ffffff');
  });

  it('has night0 as its darkest colour', () => {
    const darkest = [...names].sort((a, b) => luminance(a) - luminance(b))[0];
    expect(darkest).toBe('night0');
  });

  it('orders every ramp dark -> light', () => {
    for (const name of Object.keys(RAMPS) as RampName[]) {
      const lums = ramp(name).map(luminance);
      for (let i = 1; i < lums.length; i++) {
        expect(lums[i], `${name}${String(i)}`).toBeGreaterThan(lums[i - 1] ?? 0);
      }
    }
  });

  it('has the ramp lengths of the plan', () => {
    const lengths = Object.fromEntries(Object.entries(RAMPS).map(([k, v]) => [k, v.length]));
    expect(lengths).toEqual({
      night: 5,
      wood: 4,
      lamp: 3,
      skinA: 3,
      skinB: 3,
      skinC: 3,
      green: 2,
      blue: 2,
      magenta: 2,
      orange: 2,
      neon: 2,
      screen: 2,
    });
  });

  it('resolves names to hex and bytes, throws on unknown', () => {
    expect(colour('night0')).toBe('#1a1022');
    expect(rgba('night0')).toEqual([0x1a, 0x10, 0x22, 255]);
    expect(rgba('lamp2', 128)[3]).toBe(128);
    expect(() => colour('night9')).toThrow(/night9/);
  });

  it('maps one ramp onto another, clamping to the shorter ramp', () => {
    expect(rampMap('skinA', 'skinC')).toEqual({
      skinA0: 'skinC0',
      skinA1: 'skinC1',
      skinA2: 'skinC2',
    });
    expect(rampMap('wood', 'green')).toEqual({
      wood0: 'green0',
      wood1: 'green1',
      wood2: 'green1',
      wood3: 'green1',
    });
  });
});
