import { describe, expect, it } from 'vitest';
import sampleJson from '../../../fixtures/snapshots/sample.json';
import type { Snapshot } from '../../shared/types.js';
import type { CharacterBox } from '../office/boxes.js';
import { hotspotModel } from './hotspots.js';

const sample = sampleJson as unknown as Snapshot;
const [first, second] = sample.characters;
if (!first || !second) throw new Error('the sample needs two characters');

const boxes: CharacterBox[] = [
  { id: first.id, x: 48, y: 27, w: 24, h: 54 },
  { id: second.id, x: 240, y: 135, w: 24, h: 36 },
];

describe('hotspotModel', () => {
  it('is empty without a snapshot', () => {
    expect(hotspotModel(boxes, null, null)).toEqual([]);
  });

  it('places each box in percent of the 480x270 scene', () => {
    const [a, b] = hotspotModel(boxes, sample, null);
    expect(a).toMatchObject({ left: 10, top: 10, width: 5, height: 20 });
    expect(b).toMatchObject({ left: 50, top: 50, width: 5 });
    expect(b?.height).toBeCloseTo(13.333, 3);
  });

  it('labels "<name>, <status>" and marks the selected one', () => {
    const spots = hotspotModel(boxes, sample, second.id);
    expect(spots.map((s) => s.label)).toEqual([`${first.name}, ${first.status}`, `${second.name}, ${second.status}`]);
    expect(spots.map((s) => s.selected)).toEqual([false, true]);
  });

  it('drops boxes of unknown ids and keeps box order', () => {
    const spots = hotspotModel([{ id: 'nobody', x: 0, y: 0, w: 1, h: 1 }, ...boxes.slice().reverse()], sample, null);
    expect(spots.map((s) => s.id)).toEqual([second.id, first.id]);
  });
});
