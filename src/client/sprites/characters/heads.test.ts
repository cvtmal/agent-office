import { describe, expect, it } from 'vitest';
import { EYES, HEAD_BOX, PART_KEY, SLOTS } from './builds.js';
import {
  ACCESSORY_PARTS,
  FACE_PARTS,
  HAIRS,
  HEAD,
  HEAD_FIXED_KEY,
  accessoryFor,
  faceFor,
  headPartKey,
  type HeadPartDef,
} from './heads.js';
import { ACCESSORIES, AGENT_SPACE, FACES } from './space.js';

/** Positions of a char in a grid. */
function find(grid: readonly string[], ch: string): { x: number; y: number }[] {
  return grid.flatMap((row, y) => [...row].flatMap((c, x) => (c === ch ? [{ x, y }] : [])));
}

/** The char a head part draws over head-box pixel (x, y), '.' when none. */
function over(p: HeadPartDef, x: number, y: number): string {
  return p.grid[p.anchors.head.y + y]?.charAt(p.anchors.head.x + x) ?? '.';
}

/** The distinct non-transparent chars of a grid. */
function chars(grid: readonly string[]): Set<string> {
  return new Set([...grid.join('')].filter((c) => c !== '.'));
}

/** Head-box columns of the eyebrows (row 4, three pixels centred over each eye). */
const BROW_ROW = 4;
const BROW_COLS = EYES.flatMap((e) => [e.x - 1, e.x, e.x + 1]);

describe('head box', () => {
  it('fills the head box in slot chars', () => {
    expect([HEAD.w, HEAD.h]).toEqual([HEAD_BOX.w, HEAD_BOX.h]);
    for (const ch of chars(HEAD.grid)) expect(Object.hasOwn(SLOTS, ch), ch).toBe(true);
  });

  it('has 1x2 eyes exactly at EYES: `e` over `E`', () => {
    expect(find(HEAD.grid, 'e')).toEqual(EYES.map((p) => ({ x: p.x, y: p.y })));
    expect(find(HEAD.grid, 'E')).toEqual(EYES.map((p) => ({ x: p.x, y: p.y + 1 })));
  });
});

describe('hair styles', () => {
  it('has one style per look index of space.ts, ids unique', () => {
    expect(HAIRS).toHaveLength(AGENT_SPACE.hair);
    expect(new Set(HAIRS.map((h) => h.id)).size).toBe(HAIRS.length);
  });

  it.each(HAIRS.map((h) => [h.id, h] as const))('%s: hair slots only, eyes uncovered, eyebrows drawn', (_, h) => {
    // Only `h i j`: the look's hair ramp recolours the whole style.
    for (const ch of chars(h.grid)) expect(['h', 'i', 'j'], ch).toContain(ch);
    const a = h.anchors.head;
    expect(a.x >= 0 && a.y >= 0 && a.x + HEAD_BOX.w <= h.w).toBe(true);
    for (const e of EYES) for (const dy of [0, 1]) expect(over(h, e.x, e.y + dy), 'eye pixel').toBe('.');
    for (const x of BROW_COLS) expect(over(h, x, BROW_ROW), `brow pixel x ${String(x)}`).not.toBe('.');
  });
});

describe('face extras and accessories', () => {
  it('match the look space: none -> null, the rest index-aligned with the part lists', () => {
    expect(FACE_PARTS).toHaveLength(AGENT_SPACE.face - 1);
    expect(ACCESSORY_PARTS).toHaveLength(AGENT_SPACE.accessory - 1);
    expect(faceFor(0)).toBeNull();
    expect(accessoryFor(0)).toBeNull();
    FACES.forEach((name, i) => {
      if (i > 0) expect(faceFor(i)?.id, name).toBe(FACE_PARTS[i - 1]?.id);
    });
    ACCESSORIES.forEach((name, i) => {
      if (i > 0) expect(accessoryFor(i)?.id, name).toBe(ACCESSORY_PARTS[i - 1]?.id);
    });
    expect(faceFor(1)?.id).toBe('char-face-glasses');
    expect(accessoryFor(4)?.id).toBe('char-acc-hoops');
    expect(() => faceFor(FACES.length)).toThrow();
    expect(() => accessoryFor(-1)).toThrow();
  });

  it.each([...FACE_PARTS, ...ACCESSORY_PARTS].map((p) => [p.id, p] as const))(
    '%s: slot or fixed chars only, head box inside, eyes uncovered',
    (_, p) => {
      for (const ch of chars(p.grid)) expect(Object.hasOwn(SLOTS, ch) || Object.hasOwn(HEAD_FIXED_KEY, ch), ch).toBe(true);
      expect(p.key).toEqual(headPartKey(PART_KEY));
      const a = p.anchors.head;
      expect(a.x >= 0 && a.y >= 0 && a.x + HEAD_BOX.w <= p.w && a.y + HEAD_BOX.h <= p.h).toBe(true);
      for (const e of EYES) for (const dy of [0, 1]) expect(over(p, e.x, e.y + dy), 'eye pixel').toBe('.');
    },
  );

  it('beards take the hair ramp, so they follow the look hair colour', () => {
    for (const id of ['char-face-beard', 'char-face-glasses-beard']) {
      const p = FACE_PARTS.find((f) => f.id === id);
      expect(p?.grid.join('')).toMatch(/[hij]/);
    }
  });

  it('glasses + beard is the beard with the glasses drawn over it', () => {
    const [glasses, beard, both] = FACE_PARTS;
    for (let y = 0; y < (both?.h ?? 0); y++) {
      for (let x = 0; x < (both?.w ?? 0); x++) {
        const g = glasses?.grid[y]?.charAt(x) ?? '.';
        expect(both?.grid[y]?.charAt(x)).toBe(g === '.' ? beard?.grid[y]?.charAt(x) : g);
      }
    }
  });

  it('headPartKey adds the fixed colours on top of a look key', () => {
    const key = headPartKey({ o: 'night0' });
    expect(key['o']).toBe('night0');
    for (const [ch, name] of Object.entries(HEAD_FIXED_KEY)) expect(key[ch]).toBe(name);
  });
});
