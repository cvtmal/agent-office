import { describe, expect, it } from 'vitest';
import sampleJson from '../../../fixtures/snapshots/sample.json';
import type { Snapshot } from '../../shared/types.js';
import { stripModel } from './strip.js';

const sample = sampleJson as unknown as Snapshot;

describe('stripModel', () => {
  it('is empty without a snapshot', () => {
    expect(stripModel(null)).toEqual([]);
  });

  it('counts harbor 4 busy / 4 idle / 1 ended, HANDOVER, no drift', () => {
    const [harbor] = stripModel(sample);
    expect(harbor).toMatchObject({ name: 'harbor', busy: 4, idle: 4, ended: 1, verdict: 'HANDOVER', drift: false });
    expect(harbor?.title).toBe('busy 4 · idle 2 · waiting 1 · stopped 1 · ended 1');
  });

  it('counts notes-app 1 / 2 / 2, WARN, drift at 8 %', () => {
    const notes = stripModel(sample)[1];
    expect(notes).toMatchObject({
      name: 'notes-app',
      busy: 1,
      idle: 2,
      ended: 2,
      verdict: 'WARN',
      drift: true,
      failedPct: 8,
    });
  });

  it('has no verdict and 0 % for a project without characters or lines', () => {
    const [harbor] = sample.projects;
    if (harbor === undefined) throw new Error('no project');
    const empty: Snapshot = {
      ...sample,
      projects: [{ ...harbor, health: { ...harbor.health, lines: 0, failed: 0 } }],
      characters: [],
    };
    expect(stripModel(empty)[0]).toMatchObject({ busy: 0, idle: 0, ended: 0, verdict: null, failedPct: 0 });
  });
});
