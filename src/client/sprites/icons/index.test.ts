import { describe, expect, it } from 'vitest';
import { ACTIVITY_KINDS } from '../../../shared/constants.js';
import { rasterizeSprite, spriteById } from '../registry.js';
import { ICON_SIZE, iconId, iconsFamily } from './index.js';

describe('icons family', () => {
  it('has one icon per activity kind', () => {
    expect(iconsFamily.name).toBe('icons');
    expect(iconsFamily.sprites.map((s) => s.id)).toEqual(ACTIVITY_KINDS.map((k) => `icon-${k}`));
    for (const kind of ACTIVITY_KINDS) expect(spriteById(iconId(kind))).toBeDefined();
  });

  it.each(iconsFamily.sprites.map((s) => [s.id, s] as const))('%s is 8x8 and rasterises', (_, s) => {
    expect(ICON_SIZE).toBe(8);
    expect(s.w).toBe(8);
    expect(s.h).toBe(8);
    expect(s.grid).toHaveLength(8);
    for (const row of s.grid) expect(row).toHaveLength(8);
    const r = rasterizeSprite(s);
    expect(r.data.length).toBe(8 * 8 * 4);
    expect(r.data.some((byte, i) => i % 4 === 3 && byte > 0)).toBe(true);
  });

  it('gives every kind a distinct picture', () => {
    const grids = iconsFamily.sprites.map((s) => s.grid.join('|'));
    expect(new Set(grids).size).toBe(grids.length);
  });
});
