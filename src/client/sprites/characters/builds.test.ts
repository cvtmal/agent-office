import { describe, expect, it } from 'vitest';
import { PALETTE } from '../../render/palette.js';
import { BUILDS, CHAR_H, CHAR_W, DEFAULT_TONES, EYES, HEAD_BOX, PART_KEY, SHADOW, SLOTS, keyFor } from './builds.js';
import { composeCharacter } from './compose.js';

/** Bounding box of the opaque pixels of a raster in rows [0, toRow). */
function bbox(r: { w: number; h: number; data: Uint8ClampedArray }, toRow: number): { w: number; h: number } {
  let x0 = r.w;
  let y0 = r.h;
  let x1 = -1;
  let y1 = -1;
  for (let y = 0; y < toRow; y++) {
    for (let x = 0; x < r.w; x++) {
      if ((r.data[(y * r.w + x) * 4 + 3] ?? 0) === 0) continue;
      x0 = Math.min(x0, x);
      y0 = Math.min(y0, y);
      x1 = Math.max(x1, x);
      y1 = Math.max(y1, y);
    }
  }
  return { w: x1 - x0 + 1, h: y1 - y0 + 1 };
}

describe('slot alphabet', () => {
  it('uses single chars, never `.`, and keys every slot to a palette colour', () => {
    for (const ch of Object.keys(SLOTS)) expect(ch).toHaveLength(1);
    expect(Object.hasOwn(SLOTS, '.')).toBe(false);
    expect(Object.keys(PART_KEY).sort()).toEqual(Object.keys(SLOTS).sort());
    for (const name of Object.values(PART_KEY)) expect(Object.hasOwn(PALETTE, name), name).toBe(true);
  });

  it('closes the eyes with blink: upper pixel skin base, lower pixel skin shade', () => {
    const k = keyFor(DEFAULT_TONES, { blink: true });
    expect(k['e']).toBe(DEFAULT_TONES.skin[1]);
    expect(k['E']).toBe(DEFAULT_TONES.skin[0]);
    expect(PART_KEY['e']).toBe('night0');
  });
});

describe('builds', () => {
  it.each(BUILDS.map((b) => [b.id, b] as const))('%s: 32x48, slot chars only, anchors in place', (_, b) => {
    expect([b.w, b.h]).toEqual([CHAR_W, CHAR_H]);
    for (const ch of new Set(b.grid.join(''))) if (ch !== '.') expect(Object.hasOwn(SLOTS, ch), ch).toBe(true);
    const { head, eyes, torso, waist, shadow } = b.anchors;
    expect(head.x >= 0 && head.y >= 0 && head.x + HEAD_BOX.w <= CHAR_W && head.y + HEAD_BOX.h <= CHAR_H).toBe(true);
    expect(eyes).toEqual({ x: head.x + EYES[0].x, y: head.y + EYES[0].y });
    expect(b.anchors['eyes-r']).toEqual({ x: head.x + EYES[1].x, y: head.y + EYES[1].y });
    expect(torso.y).toBeGreaterThanOrEqual(head.y + HEAD_BOX.h);
    expect(waist.y).toBeGreaterThan(torso.y);
    expect(shadow.x + SHADOW.w).toBeLessThanOrEqual(CHAR_W);
    expect(shadow.y + SHADOW.h).toBe(CHAR_H);
  });

  it.each(BUILDS.map((b, i) => [b.id, i] as const))('%s: figure 22-26 wide, 40-46 tall (with head and hair)', (_, i) => {
    const look = { build: i, skin: 0, hair: 0, hairRamp: 0, face: 0, palette: 0, accessory: 0, overlay: 0 };
    // The shadow starts at the shadow anchor; measure the figure above the last two shadow rows.
    const fig = bbox(composeCharacter(look, 0), CHAR_H - 2);
    expect(fig.w).toBeGreaterThanOrEqual(22);
    expect(fig.w).toBeLessThanOrEqual(26);
    expect(fig.h).toBeGreaterThanOrEqual(40);
    expect(fig.h).toBeLessThanOrEqual(46);
  });
});

describe('build variety (P-5, art direction § Characters)', () => {
  /** Width of the opaque px of a build's own grid (no head, no shadow). */
  const bodyWidth = (name: string): number => {
    const grid = BUILDS.find((b) => b.id === `char-build-${name}`)?.grid ?? [];
    const cols = grid.flatMap((r) => [...r].flatMap((c, x) => (c === '.' ? [] : [x])));
    return Math.max(...cols) - Math.min(...cols) + 1;
  };

  it('has 8 builds in look order, each with its width class', () => {
    expect(BUILDS.map((b) => [b.id.replace('char-build-', ''), b.width])).toEqual([
      ['stocky', 'regular'],
      ['tall', 'regular'],
      ['round', 'regular'],
      ['slim', 'narrow'],
      ['broad', 'wide'],
      ['short', 'narrow'],
      ['curvy', 'narrow'],
      ['lanky', 'narrow'],
    ]);
  });

  it('makes the broad builds clearly wider than build 0 and the slim ones narrower', () => {
    expect(bodyWidth('stocky')).toBe(22);
    expect(bodyWidth('broad')).toBe(26);
    expect(bodyWidth('round')).toBe(26);
    for (const n of ['slim', 'short', 'lanky']) expect(bodyWidth(n), n).toBe(20);
  });

  it('gives every build its own silhouette and spreads the heads over 5 heights', () => {
    const masks = BUILDS.map((b) => b.grid.map((r) => r.replace(/[^.]/g, '#')).join('/'));
    expect(new Set(masks).size).toBe(BUILDS.length);
    expect(new Set(BUILDS.map((b) => b.anchors.head.y)).size).toBeGreaterThanOrEqual(5);
  });

  it('centres the head and keeps a belt on the waist row', () => {
    for (const b of BUILDS) {
      expect(b.anchors.head.x, b.id).toBe(9);
      expect(b.grid[b.anchors.waist.y], b.id).toMatch(/[mn]/);
    }
  });
});
