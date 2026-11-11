import { describe, expect, it } from 'vitest';
import sampleJson from '../../../../fixtures/snapshots/sample.json';
import type { Snapshot } from '../../../shared/types.js';
import { createServerClock, newestMs } from './clock.js';

const sample = sampleJson as unknown as Snapshot;
const T0 = Date.parse('2026-11-11T09:00:00Z');
const snap = (generatedAt: string, activityAt?: string): Snapshot => ({
  ...sample,
  generatedAt,
  characters: [],
  activities:
    activityAt === undefined ? [] : [{ characterId: 'x', at: activityAt, tool: 'Read', kind: 'read', target: 'a.ts' }],
});

describe('createServerClock', () => {
  it('is null before the first observe and does not tick then', () => {
    const clock = createServerClock();
    clock.tick(1000);
    expect(clock.now()).toBeNull();
  });

  it('advances by the ticked client time', () => {
    const clock = createServerClock();
    clock.observe(snap('2026-11-11T09:00:00Z'));
    expect(clock.now()).toBe(T0);
    clock.tick(5000);
    expect(clock.now()).toBe(T0 + 5000);
  });

  it('resyncs forward on a newer activity', () => {
    const clock = createServerClock();
    clock.observe(snap('2026-11-11T09:00:00Z'));
    clock.tick(1000);
    clock.observe(snap('2026-11-11T09:00:00Z', '2026-11-11T09:00:05Z'));
    expect(clock.now()).toBe(T0 + 5000);
    clock.tick(250);
    expect(clock.now()).toBe(T0 + 5250);
  });

  it('never moves back', () => {
    const clock = createServerClock();
    clock.observe(snap('2026-11-11T09:00:00Z'));
    clock.tick(10_000);
    clock.observe(snap('2026-11-11T08:00:00Z'));
    expect(clock.now()).toBe(T0 + 10_000);
    // Newer than the last seen but behind the estimate: the estimate holds.
    clock.observe(snap('2026-11-11T09:00:02Z'));
    expect(clock.now()).toBe(T0 + 10_000);
  });

  it('takes the newest of generatedAt, lastActivityAt and activity times', () => {
    expect(newestMs(sample)).toBe(T0);
    expect(newestMs(snap('2026-11-11T09:00:00Z', '2026-11-11T09:01:00Z'))).toBe(T0 + 60_000);
  });
});
