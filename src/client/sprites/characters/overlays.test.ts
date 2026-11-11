import { describe, expect, it } from 'vitest';
import { BUILDS, CHAR_H, CHAR_W, SLOTS } from './builds.js';
import { OVERLAY_PARTS, overlayFor } from './overlays.js';
import { OVERLAYS } from './space.js';

const PAIRS = OVERLAYS.flatMap((name, o) => BUILDS.map((b, i) => [`${name} on ${b.id}`, o, i] as const));

describe('overlays', () => {
  it('registers the tie, 3 hoodies (one per width class) and 8 jackets, ids unique', () => {
    const ids = OVERLAY_PARTS.map((s) => s.id);
    expect(new Set(ids).size).toBe(ids.length);
    expect(ids.filter((id) => id === 'char-overlay-tie')).toHaveLength(1);
    expect(ids.filter((id) => id.startsWith('char-overlay-hoodie-strings-')).sort()).toEqual(
      ['narrow', 'regular', 'wide'].map((w) => `char-overlay-hoodie-strings-${w}`),
    );
    expect(ids.filter((id) => id.startsWith('char-overlay-open-jacket-'))).toHaveLength(BUILDS.length);
  });

  it('has no overlay for index 0 and throws outside the look space', () => {
    for (let b = 0; b < BUILDS.length; b++) expect(overlayFor(0, b)).toBeNull();
    expect(() => overlayFor(OVERLAYS.length, 0)).toThrow();
    expect(() => overlayFor(1, BUILDS.length)).toThrow();
  });

  it.each(PAIRS.filter(([, o]) => o > 0))('%s: slot chars only, inside the frame, between collar and belt', (_, o, i) => {
    const p = overlayFor(o, i);
    const b = BUILDS[i];
    if (p === null || b === undefined) throw new Error('missing');
    for (const ch of new Set(p.def.grid.join(''))) if (ch !== '.') expect(Object.hasOwn(SLOTS, ch), ch).toBe(true);
    expect(p.def.grid).toHaveLength(p.def.h);
    for (const row of p.def.grid) expect(row).toHaveLength(p.def.w);
    expect(p.dx >= 0 && p.dy >= 0 && p.dx + p.def.w <= CHAR_W && p.dy + p.def.h <= CHAR_H).toBe(true);
    expect(p.dy).toBeGreaterThanOrEqual(b.anchors.torso.y - 3);
    expect(p.dy + p.def.h - 1).toBeLessThanOrEqual(b.anchors.waist.y);
  });

  it.each(BUILDS.map((b, i) => [b.id, i] as const))('open jacket on %s covers only the body and leaves the front open', (_, i) => {
    const p = overlayFor(3, i);
    const b = BUILDS[i];
    if (p === null || b === undefined) throw new Error('missing');
    p.def.grid.forEach((row, y) => {
      [...row].forEach((c, x) => {
        if (c === '.') return;
        const under = b.grid[p.dy + y]?.charAt(p.dx + x);
        expect(under, `(${String(p.dx + x)}, ${String(p.dy + y)})`).not.toBe('.');
        expect(under).not.toBe('o');
        expect(Math.abs(p.dx + x + 0.5 - CHAR_W / 2)).toBeGreaterThanOrEqual(2); // the opening
      });
    });
  });
});
