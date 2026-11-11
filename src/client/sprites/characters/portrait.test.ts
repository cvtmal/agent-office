import { describe, expect, it } from 'vitest';
import { rgba } from '../../render/palette.js';
import type { Raster } from '../../render/raster.js';
import { INTERN_SPACE, AGENT_SPACE, LOOK_FIELDS } from './space.js';
import type { CharacterLook } from './compose.js';
import { PORTRAIT_BORDER, PORTRAIT_FILL, PORTRAIT_SIZE, portraitFor } from './portrait.js';

const LOOK: CharacterLook = { build: 0, skin: 0, hair: 0, hairRamp: 1, face: 0, palette: 2, accessory: 0, overlay: 0 };

function px(r: Raster, x: number, y: number): string {
  return [...r.data.subarray((y * r.w + x) * 4, (y * r.w + x) * 4 + 4)].join();
}

describe('portraitFor', () => {
  for (const intern of [false, true]) {
    const space = intern ? INTERN_SPACE : AGENT_SPACE;
    it(`is a 48x48 bordered panel for every value of every field (${intern ? 'interns' : 'agents'})`, () => {
      for (const field of LOOK_FIELDS) {
        for (let v = 0; v < space[field]; v++) {
          const r = portraitFor({ ...LOOK, [field]: v }, intern);
          expect([r.w, r.h]).toEqual([PORTRAIT_SIZE, PORTRAIT_SIZE]);
          const border = rgba(PORTRAIT_BORDER).join();
          for (const [x, y] of [
            [0, 0],
            [47, 0],
            [0, 47],
            [47, 47],
            [24, 0],
            [0, 24],
          ] as const) {
            expect(px(r, x, y), `${field}=${String(v)} ${String(x)},${String(y)}`).toBe(border);
          }
        }
      }
    });

    it(`shows the face: the panel centre is not fill, the top corner is (${intern ? 'interns' : 'agents'})`, () => {
      const r = portraitFor(LOOK, intern);
      const fill = rgba(PORTRAIT_FILL).join();
      expect(px(r, 2, 2)).toBe(fill);
      expect(px(r, 24, 24)).not.toBe(fill);
      let opaque = 0;
      for (let i = 0; i < r.data.length; i += 4) if ((r.data[i + 3] ?? 0) === 255) opaque++;
      expect(opaque).toBe(PORTRAIT_SIZE * PORTRAIT_SIZE);
    });
  }

  it('differs between looks', () => {
    const a = portraitFor(LOOK, false);
    const b = portraitFor({ ...LOOK, hair: 3, hairRamp: 3 }, false);
    expect(a.data.join()).not.toBe(b.data.join());
  });
});
