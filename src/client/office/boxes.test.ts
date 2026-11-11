import { describe, expect, it } from 'vitest';
import sampleJson from '../../../fixtures/snapshots/sample.json';
import type { Snapshot } from '../../shared/types.js';
import { characterBoxes, LAYOUT_EVENT } from './boxes.js';
import { FRAME_H, FRAME_W, INTERN_H, INTERN_W } from './layout.js';
import { buildScene, type DrawItem } from './scene.js';

const sample = sampleJson as unknown as Snapshot;
const HARBOR = '/home/demo/code/harbor';

describe('characterBoxes', () => {
  const scene = buildScene(sample, HARBOR);
  const boxes = characterBoxes(scene.items);

  it('names the layout event', () => {
    expect(LAYOUT_EVENT).toBe('office:layout');
  });

  it('keeps character items only', () => {
    const characters = scene.items.filter((i) => i.kind === 'character');
    expect(boxes).toHaveLength(characters.length);
    expect(boxes.map((b) => b.id).sort()).toEqual(characters.map((i) => i.id).sort());
    expect(scene.items.some((i) => i.kind === 'prop')).toBe(true);
  });

  it('sizes interns 24x36 and sessions 32x48', () => {
    expect(INTERN_W).toBe(24);
    expect(INTERN_H).toBe(36);
    for (const item of scene.items.filter((i) => i.kind === 'character')) {
      const box = boxes.find((b) => b.id === item.id);
      expect(box).toEqual({
        id: item.id,
        x: item.x,
        y: item.y,
        w: item.intern === true ? INTERN_W : FRAME_W,
        h: item.intern === true ? INTERN_H : FRAME_H,
      });
    }
    expect(boxes.some((b) => b.w === INTERN_W)).toBe(true);
  });

  it('orders by y, then x, then id, independent of the input order', () => {
    for (let i = 1; i < boxes.length; i++) {
      const a = boxes[i - 1];
      const b = boxes[i];
      if (!a || !b) throw new Error('missing box');
      expect(a.y < b.y || (a.y === b.y && (a.x < b.x || (a.x === b.x && a.id < b.id)))).toBe(true);
    }
    expect(characterBoxes([...scene.items].reverse())).toEqual(boxes);
  });

  it('breaks ties by id', () => {
    const item = (id: string): DrawItem => ({ kind: 'character', id, x: 10, y: 20, sortY: 20 });
    expect(characterBoxes([item('b'), item('a')]).map((b) => b.id)).toEqual(['a', 'b']);
  });
});
