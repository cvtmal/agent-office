import { describe, expect, it } from 'vitest';
import { fnv1a } from './hash.js';

describe('fnv1a', () => {
  it('matches the reference vectors', () => {
    expect(fnv1a('')).toBe(0x811c9dc5);
    expect(fnv1a('a')).toBe(0xe40c292c);
    expect(fnv1a('foobar')).toBe(0xbf9cf968);
  });

  it('hashes UTF-8 bytes, not UTF-16 units', () => {
    // 'é' is C3 A9 in UTF-8; '😀' is F0 9F 98 80.
    const bytes = (b: number[]): number =>
      b.reduce((h, x) => Math.imul(h ^ x, 0x01000193) >>> 0, 0x811c9dc5);
    expect(fnv1a('é')).toBe(bytes([0xc3, 0xa9]));
    expect(fnv1a('€')).toBe(bytes([0xe2, 0x82, 0xac]));
    expect(fnv1a('😀')).toBe(bytes([0xf0, 0x9f, 0x98, 0x80]));
  });

  it('picks the themes the plan computed (P-7)', () => {
    expect(fnv1a('/home/demo/code/harbor') % 2).toBe(0);
    expect(fnv1a('/home/demo/code/notes-app') % 2).toBe(1);
  });

  it('is unsigned 32-bit and stable', () => {
    for (const s of ['x', 'cto-2', 'a longer id with spaces']) {
      const h = fnv1a(s);
      expect(h).toBe(fnv1a(s));
      expect(Number.isInteger(h) && h >= 0 && h <= 0xffffffff).toBe(true);
    }
  });
});
