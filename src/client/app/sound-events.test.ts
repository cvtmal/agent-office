import { describe, expect, it } from 'vitest';
import sampleJson from '../../../fixtures/snapshots/sample.json';
import type { Activity, Snapshot } from '../../shared/types.js';
import { createGate, soundsFor } from './sound-events.js';

const sample = sampleJson as unknown as Snapshot;
const byName = (name: string) => {
  const c = sample.characters.find((x) => x.name === name);
  if (c === undefined) throw new Error(`no ${name} in sample`);
  return c;
};

function withActivity(base: Snapshot, kind: Activity['kind']): Snapshot {
  const a: Activity = { characterId: byName('cto-2').id, at: '2026-11-11T23:59:00Z', tool: 'X', kind, target: 't' };
  return { ...base, activities: [...base.activities, a] };
}

function withStatus(base: Snapshot, name: string, status: Snapshot['characters'][number]['status']): Snapshot {
  const id = byName(name).id;
  return { ...base, characters: base.characters.map((c) => (c.id === id ? { ...c, status } : c)) };
}

function withOutcome(base: Snapshot): Snapshot {
  return {
    ...base,
    projects: base.projects.map((p) =>
      p.harness === null ? p : { ...p, harness: { ...p.harness, outcomes: [...p.harness.outcomes, { nn: 90, slug: 'x' }] } },
    ),
  };
}

describe('soundsFor', () => {
  it('is silent for the first snapshot and for no change', () => {
    expect(soundsFor(null, withOutcome(sample))).toEqual([]);
    expect(soundsFor(sample, structuredClone(sample))).toEqual([]);
  });

  it('ticks for a new write or shell activity only', () => {
    expect(soundsFor(sample, withActivity(sample, 'write'))).toEqual(['tick']);
    expect(soundsFor(sample, withActivity(sample, 'shell'))).toEqual(['tick']);
    expect(soundsFor(sample, withActivity(sample, 'read'))).toEqual([]);
  });

  it('plays coffee when a known character turns idle', () => {
    expect(soundsFor(sample, withStatus(sample, 'cto-2', 'idle'))).toEqual(['coffee']);
    expect(soundsFor(sample, withStatus(sample, 'cto-2', 'waiting'))).toEqual([]);
  });

  it('plays no coffee for a new character that arrives idle', () => {
    const fresh = { ...byName('cto-2'), id: 'new-one', status: 'idle' as const };
    expect(soundsFor(sample, { ...sample, characters: [...sample.characters, fresh] })).toEqual([]);
  });

  it('puts fanfare first and lists each kind once', () => {
    const next = withOutcome(withStatus(withActivity(withActivity(sample, 'write'), 'shell'), 'cto-2', 'idle'));
    expect(soundsFor(sample, next)).toEqual(['fanfare', 'tick', 'coffee']);
  });
});

describe('createGate', () => {
  it('lets one sound through per 200 ms', () => {
    const gate = createGate();
    expect(gate.allow('tick', 0)).toBe(true);
    expect(gate.allow('coffee', 100)).toBe(false);
    expect(gate.allow('tick', 199)).toBe(false);
    expect(gate.allow('tick', 200)).toBe(true);
  });

  it('always passes fanfare and restarts the gap', () => {
    const gate = createGate();
    expect(gate.allow('tick', 0)).toBe(true);
    expect(gate.allow('fanfare', 50)).toBe(true);
    expect(gate.allow('fanfare', 60)).toBe(true);
    expect(gate.allow('tick', 200)).toBe(false);
    expect(gate.allow('tick', 260)).toBe(true);
  });

  it('takes a custom gap', () => {
    const gate = createGate(50);
    expect(gate.allow('tick', 0)).toBe(true);
    expect(gate.allow('tick', 50)).toBe(true);
  });
});
