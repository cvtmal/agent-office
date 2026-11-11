import { describe, expect, it } from 'vitest';
import { SCENE_WIDTH } from '../../../shared/constants.js';
import { rgba } from '../../render/palette.js';
import { measure } from '../../render/font.js';
import { TAG_FILL, TAG_OUTLINE } from '../tags.js';
import { BUBBLE_H, TAIL_H, bubbleRaster, bubbleWidth, meterRect, placeBubble, sweatAt } from './draw.js';

const px = (r: { w: number; data: Uint8ClampedArray | number[] }, x: number, y: number): number[] =>
  Array.from(r.data.slice((y * r.w + x) * 4, (y * r.w + x) * 4 + 4));

describe('bubbleRaster', () => {
  it('is a tag-coloured box with cut corners, the icon and the text', () => {
    const r = bubbleRaster('read', 'scene.ts');
    expect(r.w).toBe(bubbleWidth('scene.ts'));
    expect(r.w).toBe(measure('scene.ts') + 16);
    expect(r.h).toBe(BUBBLE_H);
    expect(px(r, 0, 0)[3]).toBe(0);
    expect(px(r, 1, 0)).toEqual([...rgba(TAG_OUTLINE)]);
    expect(px(r, 1, 1)).toEqual([...rgba(TAG_FILL)]);
    // The icon's outline is drawn somewhere in its 8x8 cell.
    let iconInk = 0;
    for (let y = 2; y < 10; y++)
      for (let x = 3; x < 11; x++) if (px(r, x, y).join() === rgba(TAG_OUTLINE).join()) iconInk++;
    expect(iconInk).toBeGreaterThan(0);
  });
});

describe('placeBubble', () => {
  it('sits above the tag, centred on the head', () => {
    const p = placeBubble(40, 200, 100);
    expect(p).toEqual({ x: 180, y: 100 - 1 - TAIL_H - BUBBLE_H, tailX: 199 });
  });

  it('stays inside the scene and keeps its tail under the box', () => {
    const left = placeBubble(40, 5, 10);
    expect(left.x).toBe(0);
    expect(left.y).toBe(0);
    expect(left.tailX).toBe(4);
    const right = placeBubble(40, SCENE_WIDTH - 2, 100);
    expect(right.x).toBe(SCENE_WIDTH - 40);
    expect(right.tailX).toBe(SCENE_WIDTH - 4 - 0);
  });
});

describe('meterRect / sweatAt', () => {
  it('centres the meter under the tag without covering the head', () => {
    expect(meterRect({ x: 100, w: 32 }, 50, 60, false)).toEqual({
      x: 108,
      y: 51,
      w: 16,
      h: 3,
    });
    // Tag 3 px above the head: the 3-px bar moves up to end above the head.
    expect(meterRect({ x: 100, w: 32 }, 57, 60, false)).toEqual({
      x: 108,
      y: 57,
      w: 16,
      h: 3,
    });
    expect(meterRect({ x: 100, w: 24 }, 57, 60, true)).toEqual({
      x: 106,
      y: 58,
      w: 12,
      h: 2,
    });
  });

  it('puts the sweat drop right of the head', () => {
    expect(sweatAt({ x: 100, w: 32 }, 60, false)).toEqual({ x: 123, y: 62 });
    expect(sweatAt({ x: 100, w: 24 }, 60, true)).toEqual({ x: 117, y: 62 });
  });
});
