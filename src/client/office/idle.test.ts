import { describe, expect, it } from 'vitest';
import { fnv1a } from '../render/hash.js';
import { IDLE_FRAME_MS, idleFrame } from './idle.js';

describe('idleFrame', () => {
  it('cycles through 4 frames of 450 ms', () => {
    const id = 'x';
    const start = idleFrame(0, id, false);
    const frames = [0, 1, 2, 3, 4].map((i) => idleFrame(i * IDLE_FRAME_MS, id, false));
    expect(frames).toEqual([0, 1, 2, 3, 4].map((i) => (start + i) % 4));
    expect(idleFrame(IDLE_FRAME_MS - 1, id, false)).toBe(start);
    expect(IDLE_FRAME_MS).toBe(450);
  });

  it('offsets the phase by id', () => {
    for (const id of ['a', 'b', 'cto-2', 'some/agent']) {
      expect(idleFrame(0, id, false)).toBe(fnv1a(`${id}:idle`) % 4);
    }
    const phases = new Set(['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h'].map((id) => idleFrame(0, id, false)));
    expect(phases.size).toBeGreaterThan(1);
  });

  it('stays on frame 0 with reduced motion', () => {
    for (let t = 0; t < 4000; t += 150) expect(idleFrame(t, 'a', true)).toBe(0);
  });
});
