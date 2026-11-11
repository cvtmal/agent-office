import { describe, expect, it } from 'vitest';
import sampleJson from '../../../../fixtures/snapshots/sample.json';
import type { Snapshot } from '../../../shared/types.js';
import { PALETTE } from '../../render/palette.js';
import { cheererFor, confetti, confettiAt, CONFETTI_COLOURS, doneWallArea, newOutcomes } from './celebrate.js';
import { CONFETTI_COUNT, CONFETTI_MS } from './constants.js';

const sample = sampleJson as unknown as Snapshot;
const HARBOR = '/home/demo/code/harbor';
const NOTES = '/home/demo/code/notes-app';
const idOf = (name: string): string => sample.characters.find((c) => c.name === name)?.id ?? '';

/** The sample with one more outcome on harbor's done wall. */
function withOutcome(base: Snapshot, nn: number, slug: string): Snapshot {
  return {
    ...base,
    projects: base.projects.map((p) =>
      p.harness === null ? p : { ...p, harness: { ...p.harness, outcomes: [...p.harness.outcomes, { nn, slug }] } },
    ),
  };
}

describe('newOutcomes', () => {
  it('reports one event for a new outcome', () => {
    expect(newOutcomes(sample, withOutcome(sample, 3, 'live-updates'))).toEqual([
      { projectId: HARBOR, nn: 3, slug: 'live-updates' },
    ]);
  });

  it('reports none for the first snapshot or an unchanged wall', () => {
    expect(newOutcomes(null, sample)).toEqual([]);
    expect(newOutcomes(sample, structuredClone(sample))).toEqual([]);
  });

  it('reports none for a project first seen with harness state', () => {
    const noHarness: Snapshot = { ...sample, projects: sample.projects.map((p) => ({ ...p, harness: null })) };
    expect(newOutcomes(noHarness, sample)).toEqual([]);
  });
});

describe('cheererFor', () => {
  it('picks the lane session, else the live CTO, else nobody', () => {
    expect(cheererFor(sample, HARBOR, 'live-updates')).toBe(idOf('c03-implement'));
    // The lane's characters have ended (like the reviewer at 540 s of the replay): the CTO cheers.
    const ended: Snapshot = {
      ...sample,
      characters: sample.characters.map((c) => (c.lane?.slug === 'replay-mode' ? { ...c, status: 'ended' } : c)),
    };
    expect(cheererFor(ended, HARBOR, 'replay-mode')).toBe(idOf('cto-2'));
    expect(cheererFor(sample, HARBOR, 'no-such-lane')).toBe(idOf('cto-2'));
    expect(cheererFor(sample, NOTES, 'anything')).toBeNull();
  });
});

describe('confetti', () => {
  const area = doneWallArea();

  it('covers the done wall frames', () => {
    expect(area).toEqual({ x: 243, y: 38, w: 106, h: 28 });
  });

  it('is deterministic per seed', () => {
    const a = confetti('harbor:03-live-updates', area, 1000);
    expect(a).toHaveLength(CONFETTI_COUNT);
    expect(confetti('harbor:03-live-updates', area, 1000)).toEqual(a);
    expect(confetti('harbor:04-inspector', area, 1000)).not.toEqual(a);
    for (const p of a) {
      expect(p.x).toBeGreaterThanOrEqual(area.x);
      expect(p.x).toBeLessThanOrEqual(area.x + area.w);
      expect(PALETTE[p.colour]).toBeDefined();
      expect(CONFETTI_COLOURS).toContain(p.colour);
    }
  });

  it('falls under gravity and is gone after 2.5 s', () => {
    const a = confetti('seed', area, 1000);
    expect(confettiAt(a, 999)).toEqual([]);
    expect(confettiAt(a, 1000)).toHaveLength(CONFETTI_COUNT);
    const early = confettiAt(a, 1100);
    const late = confettiAt(a, 1000 + CONFETTI_MS - 1);
    expect(late).toHaveLength(CONFETTI_COUNT);
    const meanY = (ps: { y: number }[]): number => ps.reduce((s, p) => s + p.y, 0) / ps.length;
    expect(meanY(late)).toBeGreaterThan(meanY(early));
    expect(confettiAt(a, 1000 + CONFETTI_MS)).toEqual([]);
  });
});
