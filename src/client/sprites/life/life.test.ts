import { describe, expect, it } from 'vitest';
import { rasterizeSprite, spriteById } from '../registry.js';
import { LIFE_SPRITES, lifeFamily } from './index.js';

const IDS = [
  'life-papers',
  'life-hands0',
  'life-hands1',
  'life-terminal',
  'life-globe',
  'life-folder',
  'life-sticky',
  'life-hand',
  'life-mug',
  'life-steam0',
  'life-steam1',
  'life-sweat0',
  'life-sweat1',
];

describe('life family', () => {
  it('has exactly the plan sprites, all registered', () => {
    expect(lifeFamily.name).toBe('life');
    expect(LIFE_SPRITES.map((s) => s.id)).toEqual(IDS);
    for (const id of IDS) expect(spriteById(id), id).toBeDefined();
  });

  it.each(LIFE_SPRITES.map((s) => [s.id, s] as const))('%s: at most 12x12, no black, opaque pixels', (_, s) => {
    expect(s.w).toBeLessThanOrEqual(12);
    expect(s.h).toBeLessThanOrEqual(12);
    const r = rasterizeSprite(s);
    let opaque = 0;
    for (let i = 0; i < r.data.length; i += 4) {
      if ((r.data[i + 3] ?? 0) === 0) continue;
      opaque++;
      expect([r.data[i], r.data[i + 1], r.data[i + 2]]).not.toEqual([0, 0, 0]);
    }
    expect(opaque).toBeGreaterThan(8);
  });

  it('typing hands are mostly skin: outline pixels are fewer than a third of the hand', () => {
    for (const id of ['life-hands0', 'life-hands1']) {
      const cells = (spriteById(id)?.grid ?? []).join('').replace(/\./g, '');
      const outline = cells.replace(/[^o]/g, '').length;
      expect(outline, id).toBeLessThan(cells.length / 3);
    }
  });

  it('animation pairs differ and keep their size', () => {
    for (const [a, b] of [
      ['life-hands0', 'life-hands1'],
      ['life-steam0', 'life-steam1'],
      ['life-sweat0', 'life-sweat1'],
    ] as const) {
      const sa = spriteById(a);
      const sb = spriteById(b);
      expect([sa?.w, sa?.h]).toEqual([sb?.w, sb?.h]);
      expect(sa?.grid).not.toEqual(sb?.grid);
    }
  });
});
