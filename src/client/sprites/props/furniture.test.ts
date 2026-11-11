import { describe, expect, it } from 'vitest';
import { PLANNED_SPRITES } from '../../office/layout.js';
import { SPRITES } from './furniture.js';

const MANIFEST = [
  'desk-cto',
  'desk-cto-top',
  'lamp-cto',
  'chair-cto',
  'chair-visitor',
  'plant-tall',
  'rug-cto',
  'desk',
  'desk-open',
  'monitor',
  'monitor-off',
  'lamp-desk',
  'chair',
  'stool',
  'keyboard',
  'mug',
  'papers',
];

const byId = (id: string) => {
  const s = SPRITES.find((d) => d.id === id);
  if (!s) throw new Error(`missing ${id}`);
  return s;
};

describe('furniture sprites (step 7.1)', () => {
  it.each(MANIFEST)('%s has the size the layout places it with', (id) => {
    const s = byId(id);
    expect([s.w, s.h]).toEqual(PLANNED_SPRITES[id]);
  });

  it('adds only the mirrored monitors beyond the manifest', () => {
    const extra = SPRITES.map((s) => s.id).filter((id) => !MANIFEST.includes(id));
    expect(extra).toEqual(['monitor-l', 'monitor-off-l']);
    for (const [l, r] of [
      ['monitor-l', 'monitor'],
      ['monitor-off-l', 'monitor-off'],
    ] as const) {
      expect(byId(l).grid).toEqual(byId(r).grid.map((row) => [...row].reverse().join('')));
    }
  });

  it.each([
    ['desk', 9],
    ['desk-open', 9],
    ['desk-cto', 13],
  ] as const)('%s: the front panel (rows >= %i) is fully opaque, so it hides the lower body', (id, from) => {
    const s = byId(id);
    for (const row of s.grid.slice(from)) expect(row).not.toContain('.');
  });

  it('the screen colours appear only on the lit monitors', () => {
    const screenChars = (id: string) => {
      const s = byId(id);
      const chars = new Set(s.grid.join(''));
      return Object.entries(s.key).filter(([ch, name]) => chars.has(ch) && name.startsWith('screen'));
    };
    expect(screenChars('monitor').length).toBeGreaterThan(0);
    expect(screenChars('monitor-off')).toEqual([]);
  });

  it('the desk lamp shade keeps clear of the sitter head (cols 2-7 above row 6)', () => {
    for (const row of byId('lamp-desk').grid.slice(0, 6)) {
      expect(row.slice(0, 2) + row.slice(8)).toBe('....');
    }
  });
});
