import { describe, expect, it } from 'vitest';
import sampleJson from '../../../fixtures/snapshots/sample.json' with { type: 'json' };
import { ACTIVITIES_PER_CHARACTER } from '../../shared/constants.js';
import type { Activity, ServerEvent, Snapshot } from '../../shared/types.js';
import { validateEvent } from '../../shared/validate.js';
import { diffSnapshots } from './diff.js';

const sample = (): Snapshot => structuredClone(sampleJson) as Snapshot;

/** Diffs, checks every event against the contract, returns the events. */
function diff(prev: Snapshot | null, next: Snapshot): ServerEvent[] {
  const events = diffSnapshots(prev, next);
  for (const event of events) expect(validateEvent(event)).toEqual([]);
  return events;
}

/** `xs[i]`, failing the test when it is missing. */
function nth<T>(xs: T[], i = 0): T {
  const x = xs[i];
  if (x === undefined) throw new Error(`no element ${i}`);
  return x;
}

const types = (events: ServerEvent[]): string[] => events.map((e) => e.type);

describe('diffSnapshots', () => {
  it('sends the whole snapshot first', () => {
    const next = sample();
    expect(diff(null, next)).toEqual([{ type: 'snapshot', data: next }]);
  });

  it('sends nothing when only generatedAt changed', () => {
    const next = sample();
    next.generatedAt = '2030-01-01T00:00:00.000Z';
    expect(diff(sample(), next)).toEqual([]);
  });

  it('sends a new character', () => {
    const prev = sample();
    const next = sample();
    const added = { ...nth(next.characters), id: 'new-character', sessionId: 'new-character' };
    next.characters.push(added);
    expect(diff(prev, next)).toEqual([{ type: 'character', data: added }]);
  });

  it('sends a character whose status changed', () => {
    const prev = sample();
    const next = sample();
    const changed = nth(next.characters, 1);
    changed.status = changed.status === 'busy' ? 'idle' : 'busy';
    expect(diff(prev, next)).toEqual([{ type: 'character', data: changed }]);
  });

  it('sends a new activity after the project and character deltas', () => {
    const prev = sample();
    const next = sample();
    const character = nth(next.characters);
    const activity: Activity = { characterId: character.id, at: '2030-01-01T00:00:00Z', tool: 'Read', kind: 'read', target: 'a.ts' };
    next.activities.push(activity);
    character.lastActivityAt = activity.at;
    nth(next.projects).health.lines += 1;
    expect(types(diff(prev, next))).toEqual(['project', 'character', 'activity']);
    expect(diff(prev, next).at(-1)).toEqual({ type: 'activity', data: activity });
  });

  it('sends nothing for an activity pushed out of the last ten', () => {
    const at = (i: number): string => `2030-01-01T00:00:${String(i).padStart(2, '0')}Z`;
    const id = nth(sample().characters).id;
    const act = (i: number): Activity => ({ characterId: id, at: at(i), tool: 'Read', kind: 'read', target: `f${i}` });
    const prev = sample();
    prev.activities = Array.from({ length: ACTIVITIES_PER_CHARACTER }, (_, i) => act(i));
    const next = sample();
    next.activities = Array.from({ length: ACTIVITIES_PER_CHARACTER }, (_, i) => act(i + 1));
    expect(diff(prev, next)).toEqual([{ type: 'activity', data: act(ACTIVITIES_PER_CHARACTER) }]);
  });

  it('sends one snapshot when a character left', () => {
    const prev = sample();
    const next = sample();
    next.characters.pop();
    nth(next.characters).status = 'ended';
    expect(diff(prev, next)).toEqual([{ type: 'snapshot', data: next }]);
  });

  it('sends one snapshot when a project left', () => {
    const prev = sample();
    const next = sample();
    const gone = nth(next.projects, next.projects.length - 1).id;
    next.projects.pop();
    next.characters = next.characters.filter((c) => c.projectId !== gone);
    const kept = new Set(next.characters.map((c) => c.id));
    next.activities = next.activities.filter((a) => kept.has(a.characterId));
    expect(diff(prev, next)).toEqual([{ type: 'snapshot', data: next }]);
  });

  it('sends a project whose harness changed', () => {
    const prev = sample();
    const next = sample();
    const project = nth(next.projects);
    project.harness = { lanes: [], ctoGeneration: 9, phase: 'plan', wave: 'W9', outcomes: [], lastCommit: null };
    expect(diff(prev, next)).toEqual([{ type: 'project', data: project }]);
  });
});
