import { describe, expect, it } from 'vitest';
import sampleJson from '../../../fixtures/snapshots/sample.json';
import { ACTIVITIES_PER_CHARACTER } from '../../shared/constants.js';
import type { Activity, Character, Project, Snapshot } from '../../shared/types.js';
import { validateSnapshot } from '../../shared/validate.js';
import { applyEvent } from './apply.js';

const sample = sampleJson as unknown as Snapshot;

function first<T>(list: T[]): T {
  const x = list[0];
  if (x === undefined) throw new Error('empty fixture list');
  return x;
}

function activity(characterId: string, at: string, target = 'x.ts'): Activity {
  return { characterId, at, tool: 'Read', kind: 'read', target };
}

describe('applyEvent', () => {
  it('a snapshot replaces whatever was there', () => {
    expect(applyEvent(null, { type: 'snapshot', data: sample })).toBe(sample);
    const other = { ...sample, characters: [] };
    expect(applyEvent(sample, { type: 'snapshot', data: other })).toBe(other);
  });

  it('a delta before any snapshot gives null', () => {
    const c = first(sample.characters);
    expect(applyEvent(null, { type: 'character', data: c })).toBeNull();
    expect(applyEvent(null, { type: 'project', data: first(sample.projects) })).toBeNull();
    expect(applyEvent(null, { type: 'activity', data: activity(c.id, '2026-11-11T09:00:00Z') })).toBeNull();
  });

  it('a character replaces the one with its id', () => {
    const c = first(sample.characters);
    const changed: Character = { ...c, status: 'idle', tokens: c.tokens + 1 };
    const next = applyEvent(sample, { type: 'character', data: changed });
    expect(next).not.toBe(sample);
    expect(next?.characters).toHaveLength(sample.characters.length);
    expect(next?.characters.find((x) => x.id === c.id)).toBe(changed);
    expect(next?.characters.indexOf(changed)).toBe(0);
    expect(sample.characters[0]).toBe(c); // input untouched
    expect(validateSnapshot(next)).toEqual([]);
  });

  it('an unchanged character returns the same snapshot', () => {
    const c = first(sample.characters);
    expect(applyEvent(sample, { type: 'character', data: { ...c } })).toBe(sample);
  });

  it('a new character is inserted in id order', () => {
    const base: Snapshot = { ...sample, characters: [...sample.characters].sort((a, b) => (a.id < b.id ? -1 : 1)) };
    const c = first(base.characters);
    const added: Character = { ...c, id: `${c.id}/agent-new`, agentId: 'agent-new', parentId: c.id, kind: 'agent' };
    const next = applyEvent(base, { type: 'character', data: added });
    const ids = next?.characters.map((x) => x.id) ?? [];
    expect(ids).toHaveLength(base.characters.length + 1);
    expect(ids).toEqual([...ids].sort());
    expect(validateSnapshot(next)).toEqual([]);
  });

  it('a project replaces by id or is inserted in id order', () => {
    const p = first(sample.projects);
    const renamed: Project = { ...p, name: 'renamed' };
    const replaced = applyEvent(sample, { type: 'project', data: renamed });
    expect(replaced?.projects.find((x) => x.id === p.id)).toBe(renamed);
    expect(replaced?.projects).toHaveLength(sample.projects.length);
    expect(validateSnapshot(replaced)).toEqual([]);

    const added: Project = { ...p, id: '/home/demo/code/aaa-first', name: 'aaa-first' };
    const inserted = applyEvent(sample, { type: 'project', data: added });
    expect(inserted?.projects.map((x) => x.id)).toEqual([...sample.projects.map((x) => x.id), added.id].sort());
    expect(validateSnapshot(inserted)).toEqual([]);
    expect(applyEvent(sample, { type: 'project', data: { ...p } })).toBe(sample);
  });

  it('an activity is appended in time order', () => {
    const c = first(sample.characters);
    const a = activity(c.id, '2099-01-01T00:00:00Z');
    const next = applyEvent(sample, { type: 'activity', data: a });
    expect(next?.activities).toHaveLength(sample.activities.length + 1);
    expect(next?.activities.at(-1)).toBe(a);
    expect(validateSnapshot(next)).toEqual([]);
  });

  it(`keeps the last ${String(ACTIVITIES_PER_CHARACTER)} activities per character`, () => {
    const c = first(sample.characters);
    let snap: Snapshot | null = sample;
    for (let i = 0; i < ACTIVITIES_PER_CHARACTER + 3; i++) {
      const at = `2099-01-01T00:00:${String(i).padStart(2, '0')}Z`;
      snap = applyEvent(snap, { type: 'activity', data: activity(c.id, at, `f${String(i)}.ts`) });
    }
    const own = snap?.activities.filter((a) => a.characterId === c.id) ?? [];
    expect(own).toHaveLength(ACTIVITIES_PER_CHARACTER);
    expect(own.map((a) => a.target)).toEqual(
      Array.from({ length: ACTIVITIES_PER_CHARACTER }, (_, i) => `f${String(i + 3)}.ts`),
    );
    const others = (s: Snapshot | null): Activity[] => s?.activities.filter((a) => a.characterId !== c.id) ?? [];
    expect(others(snap)).toEqual(others(sample));
    expect(validateSnapshot(snap)).toEqual([]);

    // Older than everything kept for a full character: nothing changes.
    expect(applyEvent(snap, { type: 'activity', data: activity(c.id, '2000-01-01T00:00:00Z') })).toBe(snap);
  });

  it('an activity for an unknown character is ignored', () => {
    expect(applyEvent(sample, { type: 'activity', data: activity('no-such-character', '2099-01-01T00:00:00Z') })).toBe(
      sample,
    );
  });
});
