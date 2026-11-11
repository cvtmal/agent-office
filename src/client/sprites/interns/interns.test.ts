import { describe, expect, it } from 'vitest';
import type { Raster } from '../../render/raster.js';
import { INTERN_H as LAYOUT_INTERN_H, INTERN_W as LAYOUT_INTERN_W } from '../../office/layout.js';
import { CHAR_H } from '../characters/builds.js';
import { PALETTE } from '../../render/palette.js';
import { POSE_FRAMES, type CharacterLook, type IdleFrame } from '../characters/compose.js';
import { INTERN_ACCESSORIES, INTERN_SPACE, LOOK_FIELDS } from '../characters/space.js';
import {
  INTERN_BUILDS,
  INTERN_COUNTS,
  INTERN_H,
  INTERN_HAIRS,
  INTERN_HEAD_BOX,
  INTERN_SHADOW,
  INTERN_W,
  composeIntern,
  internsFamily,
} from './index.js';

const LOOK: CharacterLook = { build: 0, skin: 0, hair: 0, hairRamp: 1, face: 0, palette: 2, accessory: 0, overlay: 0 };
const FRAMES: readonly IdleFrame[] = [0, 1, 2, 3];

/** Alpha of pixel (x, y). */
function alpha(r: Raster, x: number, y: number): number {
  return r.data[(y * r.w + x) * 4 + 3] ?? 0;
}

/** Number of opaque pixels in rows [from, to). */
function opaque(r: Raster, from = 0, to = r.h): number {
  let n = 0;
  for (let y = from; y < to; y++) for (let x = 0; x < r.w; x++) if (alpha(r, x, y) > 0) n++;
  return n;
}

/** Pixels where two rasters of the same size differ. */
function diff(a: Raster, b: Raster): { x: number; y: number }[] {
  const out: { x: number; y: number }[] = [];
  for (let i = 0; i < a.data.length; i += 4) {
    if (a.data.slice(i, i + 4).join() !== b.data.slice(i, i + 4).join()) out.push({ x: (i / 4) % a.w, y: Math.floor(i / 4 / a.w) });
  }
  return out;
}

/** The alpha mask of a raster as a string (silhouette). */
function silhouette(r: Raster): string {
  let s = '';
  for (let y = 0; y < r.h; y++) for (let x = 0; x < r.w; x++) s += alpha(r, x, y) > 0 ? '#' : '.';
  return s;
}

describe('interns family', () => {
  it('has 24x36 frames, the size office/layout.ts places interns with', () => {
    expect([INTERN_W, INTERN_H]).toEqual([24, 36]);
    expect([INTERN_W, INTERN_H]).toEqual([LAYOUT_INTERN_W, LAYOUT_INTERN_H]);
  });

  it('draws as many variants as INTERN_SPACE asks for', () => {
    expect(INTERN_COUNTS.build).toBe(INTERN_SPACE.build);
    expect(INTERN_COUNTS.hair).toBe(INTERN_SPACE.hair);
    expect(INTERN_COUNTS.accessory).toBe(INTERN_SPACE.accessory);
    expect(INTERN_ACCESSORIES).toEqual(['none', 'cap', 'headphones']);
  });

  it('registers every part with an intern- id', () => {
    expect(internsFamily.sprites.length).toBeGreaterThanOrEqual(3 + 1 + 1 + 4 + 2);
    for (const s of internsFamily.sprites) expect(s.id).toMatch(/^intern-/);
  });

  it.each(INTERN_BUILDS.map((b) => [b.id, b] as const))('%s: head box inside the frame, centred, feet on rows 32-33', (_, b) => {
    const { head, waist, shadow, torso, eyes } = b.anchors;
    expect(head.x + INTERN_HEAD_BOX.w / 2).toBe(INTERN_W / 2);
    expect(head.y).toBeGreaterThanOrEqual(3);
    expect(head.y + INTERN_HEAD_BOX.h).toBeLessThanOrEqual(torso.y + 1);
    expect(eyes.y).toBe(head.y + 4);
    expect(waist.y).toBeGreaterThan(torso.y);
    expect(shadow).toEqual({ x: 2, y: 32 });
    expect(b.grid[32]).toMatch(/f/);
    expect(b.grid[33]).toMatch(/^\.*o+\.+o+\.*$/);
    expect(b.grid.slice(34).join('')).toMatch(/^\.+$/);
  });
});

describe('composeIntern', () => {
  it('is a non-empty 24x36 frame', () => {
    const r = composeIntern(LOOK, 0);
    expect([r.w, r.h]).toEqual([INTERN_W, INTERN_H]);
    expect(opaque(r)).toBeGreaterThan(250);
  });

  it('stands on a foot shadow in the bottom rows, like the agents (sole outline at h - 3)', () => {
    const r = composeIntern(LOOK, 0);
    expect(opaque(r, INTERN_H - 2, INTERN_H)).toBeGreaterThan(8);
    expect(INTERN_SHADOW.w).toBe(20);
    expect(INTERN_H - 3).toBe(33);
    expect(CHAR_H - 3).toBe(45);
  });

  it('keeps the hair inside the frame (no clipped rows at the top)', () => {
    for (const build of INTERN_BUILDS.keys()) {
      for (const hair of INTERN_HAIRS.keys()) {
        const r = composeIntern({ ...LOOK, build, hair }, 0);
        expect(opaque(r, 0, 1), `build ${String(build)} hair ${String(hair)}`).toBeLessThan(6);
      }
    }
  });

  it.each(LOOK_FIELDS.map((f) => [f] as const))('every %s value composes in every idle frame', (field) => {
    for (let i = 0; i < INTERN_SPACE[field]; i++) {
      for (const frame of FRAMES) {
        const r = composeIntern({ ...LOOK, [field]: i }, frame);
        expect(r.data.length).toBe(INTERN_W * INTERN_H * 4);
      }
    }
  });

  it('gives each build, hair style and accessory its own silhouette', () => {
    for (const field of ['build', 'hair', 'accessory'] as const) {
      const shapes = Array.from({ length: INTERN_SPACE[field] }, (_, i) => silhouette(composeIntern({ ...LOOK, [field]: i }, 0)));
      expect(new Set(shapes).size, field).toBe(shapes.length);
    }
  });

  it('frame 1 sinks the upper body by 1 px, frame 2 equals frame 0', () => {
    const rest = composeIntern(LOOK, 0);
    expect(diff(composeIntern(LOOK, 2), rest)).toEqual([]);
    const breathe = composeIntern(LOOK, 1);
    const waist = INTERN_BUILDS[0]?.anchors.waist.y ?? 0;
    const changed = diff(breathe, rest);
    expect(changed.length).toBeGreaterThan(0);
    expect(changed.every((p) => p.y <= waist)).toBe(true);
  });

  it('frame 3 changes only the eye pixels (blink)', () => {
    const b = INTERN_BUILDS[0];
    if (!b) throw new Error('no build');
    const { eyes, 'eyes-r': eyesR } = b.anchors;
    const eyePx = new Set([eyes, eyesR].flatMap((e) => [`${String(e.x)},${String(e.y)}`, `${String(e.x)},${String(e.y + 1)}`]));
    const changed = diff(composeIntern(LOOK, 3), composeIntern(LOOK, 0));
    expect(changed.length).toBe(4);
    for (const p of changed) expect(eyePx.has(`${String(p.x)},${String(p.y)}`)).toBe(true);
  });

  it('every pose frame of every build is 24x36, differs from frame 0 and uses only palette colours', () => {
    const rgb = new Set(Object.values(PALETTE).map((hex) => [1, 3, 5].map((i) => Number.parseInt(hex.slice(i, i + 2), 16)).join()));
    for (const field of LOOK_FIELDS) {
      for (let v = 0; v < INTERN_SPACE[field]; v++) {
        const look = { ...LOOK, [field]: v };
        const rest = composeIntern(look, 0);
        for (const pose of POSE_FRAMES) {
          const r = composeIntern(look, pose);
          const at = `${field}=${String(v)} ${pose}`;
          expect([r.w, r.h], at).toEqual([INTERN_W, INTERN_H]);
          expect(diff(rest, r).length, at).toBeGreaterThan(0);
          expect(opaque(r), at).toBeGreaterThan(150);
          for (let i = 0; i < r.data.length; i += 4) {
            if ((r.data[i + 3] ?? 0) > 0) expect(rgb.has([...r.data.subarray(i, i + 3)].join()), at).toBe(true);
          }
        }
      }
    }
  });

  it('poses: walk0/walk2 lift opposite feet, head lowers the head, cheer1 raises the hands a row above cheer0', () => {
    const rest = composeIntern(LOOK, 0);
    const waist = INTERN_BUILDS[0]?.anchors.waist.y ?? 0;
    expect(diff(rest, composeIntern(LOOK, 'walk0')).every((p) => p.y > waist + 1 && p.x < INTERN_W / 2 + 1)).toBe(true);
    expect(diff(rest, composeIntern(LOOK, 'walk2')).every((p) => p.y > waist + 1 && p.x >= INTERN_W / 2 - 1)).toBe(true);
    const top = (r: Raster, x1 = r.w): number => {
      for (let y = 0; y < r.h; y++) for (let x = 0; x < x1; x++) if (alpha(r, x, y) > 0) return y;
      return r.h;
    };
    expect(top(composeIntern(LOOK, 'head'))).toBeGreaterThan(top(rest));
    for (const build of INTERN_BUILDS.keys()) {
      const look = { ...LOOK, build };
      expect(top(composeIntern(look, 'cheer1'), 6)).toBe(top(composeIntern(look, 'cheer0'), 6) - 1);
    }
  });

  it('hides the hair above the cap: under a cap, tuft, mop and spikes share the same top rows', () => {
    const top = (hair: number): string => {
      const r = composeIntern({ ...LOOK, hair, accessory: 1 }, 0);
      return silhouette(r).slice(0, INTERN_W * (INTERN_BUILDS[0]?.anchors.head.y ?? 0));
    };
    expect(top(1)).toBe(top(0));
    expect(top(3)).toBe(top(0));
  });
});
