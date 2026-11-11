import { describe, expect, it } from 'vitest';
import { PALETTE } from '../../render/palette.js';
import type { Raster } from '../../render/raster.js';
import { BUILDS, CHAR_H, CHAR_W, SLOTS } from './builds.js';
import {
  CHARACTER_COUNTS,
  CLOTH_SETS,
  HAIR_TONES,
  MATERIALS,
  POSE_FRAMES,
  composeCharacter,
  fitTop,
  tonesFor,
  type CharacterLook,
} from './compose.js';
import { rasterize } from '../../render/raster.js';
import { AGENT_SPACE, HAIR_RAMPS, LOOK_FIELDS } from './space.js';

const LOOK: CharacterLook = { build: 0, skin: 0, hair: 0, hairRamp: 1, face: 0, palette: 2, accessory: 0, overlay: 0 };

/** Coordinates of every pixel where two rasters of the same size differ. */
function diff(a: Raster, b: Raster): { x: number; y: number }[] {
  const out: { x: number; y: number }[] = [];
  for (let i = 0; i < a.data.length; i += 4) {
    if (a.data.slice(i, i + 4).join() !== b.data.slice(i, i + 4).join()) {
      out.push({ x: (i / 4) % a.w, y: Math.floor(i / 4 / a.w) });
    }
  }
  return out;
}

/** Number of opaque pixels in rows [from, to). */
function opaque(r: Raster, from = 0, to = r.h): number {
  let n = 0;
  for (let y = from; y < to; y++) for (let x = 0; x < r.w; x++) if ((r.data[(y * r.w + x) * 4 + 3] ?? 0) > 0) n++;
  return n;
}

describe('composeCharacter', () => {
  it('is a non-empty 32x48 frame', () => {
    const r = composeCharacter(LOOK, 0);
    expect([r.w, r.h]).toEqual([CHAR_W, CHAR_H]);
    expect(opaque(r)).toBeGreaterThan(400);
  });

  it('has foot-shadow pixels in the bottom 4 rows, below the feet', () => {
    const r = composeCharacter(LOOK, 0);
    expect(opaque(r, CHAR_H - 4, CHAR_H)).toBeGreaterThan(20);
    expect(opaque(r, CHAR_H - 2, CHAR_H)).toBeGreaterThan(8);
  });

  it('frame 2 is the rest pose, like frame 0', () => {
    expect(diff(composeCharacter(LOOK, 0), composeCharacter(LOOK, 2))).toEqual([]);
  });

  it('frame 1 (breathe) differs from frame 0 only on and above the waist row', () => {
    const waist = BUILDS[0]?.anchors.waist.y ?? 0;
    const d = diff(composeCharacter(LOOK, 0), composeCharacter(LOOK, 1));
    expect(d.length).toBeGreaterThan(10);
    for (const p of d) expect(p.y, `pixel ${String(p.x)},${String(p.y)}`).toBeLessThanOrEqual(waist);
  });

  it('frame 3 (blink) differs from frame 0 only in the two 1x2 eye cells', () => {
    const a = BUILDS[0]?.anchors;
    if (!a) throw new Error('no build 0');
    const cells = [a.eyes, a['eyes-r']].flatMap((e) => [`${String(e.x)},${String(e.y)}`, `${String(e.x)},${String(e.y + 1)}`]);
    const d = diff(composeCharacter(LOOK, 0), composeCharacter(LOOK, 3)).map((p) => `${String(p.x)},${String(p.y)}`);
    expect(d.sort()).toEqual(cells.sort());
  });

  it('is deterministic', () => {
    expect(diff(composeCharacter(LOOK, 1), composeCharacter(LOOK, 1))).toEqual([]);
  });

  it('composes every value of every look field, and the field changes the pixels where parts exist', () => {
    for (const field of LOOK_FIELDS) {
      for (let v = 0; v < AGENT_SPACE[field]; v++) {
        const r = composeCharacter({ ...LOOK, [field]: v }, 0);
        expect(r.w * r.h).toBe(CHAR_W * CHAR_H);
      }
    }
    for (const field of ['skin', 'hairRamp', 'palette'] as const) {
      const a = composeCharacter({ ...LOOK, [field]: 0 }, 0);
      const b = composeCharacter({ ...LOOK, [field]: 1 }, 0);
      expect(diff(a, b).length, field).toBeGreaterThan(0);
    }
  });
});

describe('composeCharacter, every look field (phase 13)', () => {
  it('draws as many variants as the look space has', () => {
    for (const [field, n] of Object.entries(CHARACTER_COUNTS)) {
      expect(n, field).toBe(AGENT_SPACE[field as keyof typeof AGENT_SPACE]);
    }
  });

  it('composes every value of every field in all 4 idle frames', () => {
    for (const field of LOOK_FIELDS) {
      for (let v = 0; v < AGENT_SPACE[field]; v++) {
        for (const frame of [0, 1, 2, 3] as const) {
          const r = composeCharacter({ ...LOOK, [field]: v }, frame);
          expect(opaque(r), `${field}=${String(v)} frame ${String(frame)}`).toBeGreaterThan(400);
        }
      }
    }
  });

  it('every value of build, hair, face, accessory and overlay changes the pixels', () => {
    for (const field of ['build', 'hair', 'face', 'accessory', 'overlay'] as const) {
      const seen = new Set<string>();
      for (let v = 0; v < AGENT_SPACE[field]; v++) seen.add(composeCharacter({ ...LOOK, [field]: v }, 0).data.join());
      expect(seen.size, field).toBe(AGENT_SPACE[field]);
    }
  });

  it('a cap or beanie hides the hair above it: mohawk under a hat is no taller than a bald head under it', () => {
    for (const accessory of [2, 3]) {
      const top = (hair: number): number => {
        const r = composeCharacter({ ...LOOK, hair, accessory }, 0);
        for (let y = 0; y < r.h; y++) for (let x = 0; x < r.w; x++) if ((r.data[(y * r.w + x) * 4 + 3] ?? 0) > 0) return y;
        return r.h;
      };
      expect(top(5), `accessory ${String(accessory)}`).toBe(top(7));
    }
  });

  it('the beanie is not knitted in the top colour', () => {
    const tones = tonesFor(LOOK);
    const r = composeCharacter({ ...LOOK, accessory: 3 }, 0);
    const head = BUILDS[0]?.anchors.head ?? { x: 0, y: 0 };
    const at = ((head.y - 1) * r.w + head.x + 7) * 4;
    const hex = [...r.data.subarray(at, at + 3)].map((c) => c.toString(16).padStart(2, '0')).join('');
    for (const name of tones.top) expect(`#${hex}`).not.toBe(PALETTE[name]);
  });

  it('fitTop keeps the top row of a part that starts above the frame', () => {
    const l = { raster: rasterize(['a', 'b', 'c', 'd'], { a: 'night0', b: 'lamp2', c: 'lamp1', d: 'lamp0' }), dx: 0, dy: -1 };
    const f = fitTop(l);
    expect([f.dy, f.raster.h]).toEqual([0, 3]);
    expect([...f.raster.data.subarray(0, 4)]).toEqual([...l.raster.data.subarray(0, 4)]);
    expect([...f.raster.data.subarray(4, 8)]).toEqual([...l.raster.data.subarray(8, 12)]);
    expect(fitTop({ ...l, dy: 2 })).toEqual({ ...l, dy: 2 });
  });

  it('tall styles keep their top outline on high-head builds (no flat cut at row 0)', () => {
    const tall = BUILDS.findIndex((b) => b.anchors.head.y === 3);
    expect(tall).toBeGreaterThan(0);
    const r = composeCharacter({ ...LOOK, build: tall, hair: 5 }, 0);
    let row0 = 0;
    for (let x = 0; x < r.w; x++) if ((r.data[x * 4 + 3] ?? 0) > 0) row0++;
    expect(row0).toBe(2);
  });
});

describe('look tones', () => {
  it('has a cloth set per palette, all tops different', () => {
    expect(CLOTH_SETS).toHaveLength(AGENT_SPACE.palette);
    expect(new Set(CLOTH_SETS.map((c) => c.top)).size).toBe(CLOTH_SETS.length);
  });

  it('has hair tones per hair ramp; every material and hair tone is a palette colour', () => {
    expect(Object.keys(HAIR_TONES)).toEqual([...HAIR_RAMPS]);
    for (const tones of [...Object.values(MATERIALS), ...Object.values(HAIR_TONES)]) {
      expect(tones).toHaveLength(3);
      for (const name of tones) expect(Object.hasOwn(PALETTE, name), name).toBe(true);
    }
  });

  it('gives every slot of the alphabet a palette colour for every look', () => {
    for (let palette = 0; palette < AGENT_SPACE.palette; palette++) {
      const tones = tonesFor({ ...LOOK, palette });
      for (const { part, tone } of Object.values(SLOTS)) {
        const ramp = tones[part];
        expect(ramp.length).toBeGreaterThan(0);
        expect(Object.hasOwn(PALETTE, ramp[Math.min(tone, ramp.length - 1)] ?? ''), part).toBe(true);
      }
    }
  });
});

/** `r,g,b` of every palette colour. */
const PALETTE_RGB = new Set(
  Object.values(PALETTE).map((hex) => [1, 3, 5].map((i) => Number.parseInt(hex.slice(i, i + 2), 16)).join()),
);

/** Every opaque pixel is a palette colour. */
function onlyPalette(r: Raster): boolean {
  for (let i = 0; i < r.data.length; i += 4) {
    if ((r.data[i + 3] ?? 0) > 0 && !PALETTE_RGB.has([...r.data.subarray(i, i + 3)].join())) return false;
  }
  return true;
}

/** Topmost opaque row. */
function topRow(r: Raster): number {
  for (let y = 0; y < r.h; y++) if (opaque(r, y, y + 1) > 0) return y;
  return r.h;
}

/** Topmost opaque row in the 8 leftmost columns (a raised left arm). */
function sideTop(r: Raster): number {
  for (let y = 0; y < r.h; y++) for (let x = 0; x < 8; x++) if ((r.data[(y * r.w + x) * 4 + 3] ?? 0) > 0) return y;
  return r.h;
}

describe('composeCharacter, pose frames (#5)', () => {
  it('exports the seven pose frames', () => {
    expect([...POSE_FRAMES]).toEqual(['walk0', 'walk1', 'walk2', 'walk3', 'head', 'cheer0', 'cheer1']);
  });

  it('every pose of every build is 32x48, differs from frame 0 and uses only palette colours', () => {
    for (let build = 0; build < AGENT_SPACE.build; build++) {
      const rest = composeCharacter({ ...LOOK, build }, 0);
      for (const pose of POSE_FRAMES) {
        const r = composeCharacter({ ...LOOK, build }, pose);
        const at = `build ${String(build)} ${pose}`;
        expect([r.w, r.h], at).toEqual([CHAR_W, CHAR_H]);
        expect(diff(rest, r).length, at).toBeGreaterThan(0);
        expect(onlyPalette(r), at).toBe(true);
        expect(opaque(r), at).toBeGreaterThan(250);
      }
    }
  });

  it('composes every pose for every value of every look field', () => {
    for (const field of LOOK_FIELDS) {
      for (let v = 0; v < AGENT_SPACE[field]; v++) {
        for (const pose of POSE_FRAMES) {
          const r = composeCharacter({ ...LOOK, [field]: v }, pose);
          expect(onlyPalette(r), `${field}=${String(v)} ${pose}`).toBe(true);
        }
      }
    }
  });

  it('walk: frames 0 and 2 lift opposite feet (only leg rows change), frames 1 and 3 bob the upper body', () => {
    const waist = BUILDS[0]?.anchors.waist.y ?? 0;
    const rest = composeCharacter(LOOK, 0);
    const left = diff(rest, composeCharacter(LOOK, 'walk0'));
    const right = diff(rest, composeCharacter(LOOK, 'walk2'));
    expect(left.length).toBeGreaterThan(0);
    expect(right.length).toBeGreaterThan(0);
    expect(left.every((p) => p.y > waist + 1 && p.x < CHAR_W / 2 + 1)).toBe(true);
    expect(right.every((p) => p.y > waist + 1 && p.x >= CHAR_W / 2 - 1)).toBe(true);
    expect(diff(rest, composeCharacter(LOOK, 'walk1')).some((p) => p.y < waist)).toBe(true);
    expect(diff(composeCharacter(LOOK, 'walk1'), composeCharacter(LOOK, 'walk3'))).toEqual([]);
  });

  it('head: the head is lowered (top row moves down) and the eyes are covered', () => {
    for (let build = 0; build < AGENT_SPACE.build; build++) {
      const look = { ...LOOK, build };
      expect(topRow(composeCharacter(look, 'head')), `build ${String(build)}`).toBeGreaterThan(topRow(composeCharacter(look, 0)));
    }
    const eyes = BUILDS[0]?.anchors.eyes ?? { x: 0, y: 0 };
    const at = (eyes.y * CHAR_W + eyes.x) * 4;
    const px = (r: Raster): string => [...r.data.subarray(at, at + 3)].join();
    expect(px(composeCharacter(LOOK, 'head'))).not.toBe(px(composeCharacter(LOOK, 0)));
  });

  it('cheer: hands above the eyes beside the head, frame 1 one row higher', () => {
    for (let build = 0; build < AGENT_SPACE.build; build++) {
      const look = { ...LOOK, build, hair: 7 };
      const c0 = composeCharacter(look, 'cheer0');
      const c1 = composeCharacter(look, 'cheer1');
      const head = BUILDS[build]?.anchors.head.y ?? 0;
      expect(sideTop(c0), `build ${String(build)}`).toBeLessThan(head + 6);
      expect(sideTop(c1), `build ${String(build)}`).toBe(sideTop(c0) - 1);
    }
  });
});
