// Checks every sprite of every family; passes with empty families and keeps
// passing as the sprite phases fill them.
import { describe, expect, it } from 'vitest';
import { PALETTE } from '../render/palette.js';
import { FAMILIES, rasterizeSprite, spriteById } from './registry.js';

const ALL = FAMILIES.flatMap((f) => f.sprites.map((s) => ({ family: f.name, s })));

describe('sprite registry', () => {
  it('has the five families with unique names', () => {
    const names = FAMILIES.map((f) => f.name);
    expect(names).toEqual(['tiles', 'shell', 'props', 'characters', 'interns']);
  });

  it('has unique sprite ids, all found by spriteById', () => {
    const ids = ALL.map(({ s }) => s.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const { s } of ALL) expect(spriteById(s.id)).toBe(s);
    expect(spriteById('no-such-sprite')).toBeUndefined();
  });

  it.each(ALL.map(({ family, s }) => [`${family}/${s.id}`, s] as const))(
    '%s: grid matches w x h, every char is keyed, every key is a palette colour',
    (_, s) => {
      expect(s.grid.length, 'rows').toBe(s.h);
      for (const row of s.grid) expect(row.length, 'row width').toBe(s.w);
      for (const ch of new Set(s.grid.join(''))) {
        if (ch !== '.') expect(Object.hasOwn(s.key, ch), `char '${ch}' in key`).toBe(true);
      }
      expect(Object.hasOwn(s.key, '.'), "'.' is reserved for transparency").toBe(false);
      for (const [ch, name] of Object.entries(s.key)) {
        expect(ch).toHaveLength(1);
        expect(Object.hasOwn(PALETTE, name), `key '${ch}' -> '${name}' in PALETTE`).toBe(true);
      }
      for (const [name, a] of Object.entries(s.anchors ?? {})) {
        expect(a.x >= 0 && a.x <= s.w && a.y >= 0 && a.y <= s.h, `anchor ${name}`).toBe(true);
      }
      const r = rasterizeSprite(s);
      expect(r.data.length).toBe(s.w * s.h * 4);
    },
  );
});
