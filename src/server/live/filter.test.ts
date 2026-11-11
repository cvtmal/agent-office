import { describe, expect, it } from 'vitest';
import type { Snapshot } from '../../shared/types.js';
import { validateSnapshot } from '../../shared/validate.js';
import { loadSampleSnapshot } from '../sample.js';
import { filterFor } from './filter.js';

const HARBOR = '/home/demo/code/harbor';
const NOTES = '/home/demo/code/notes-app';
const STUDIO = '/home/demo/code/studio';
const sample = loadSampleSnapshot();

function ids(s: Snapshot): { projects: string[]; characters: number; activities: number } {
  return { projects: s.projects.map((p) => p.id), characters: s.characters.length, activities: s.activities.length };
}

function expectValid(s: Snapshot): void {
  expect(validateSnapshot(s)).toEqual([]);
}

describe('filterFor', () => {
  it('is the identity when projects and exclude are empty', () => {
    expect(filterFor({ projects: [], exclude: [] })(sample)).toBe(sample);
  });

  it('the sample has the three projects these tests rely on', () => {
    expect(ids(sample).projects).toEqual([HARBOR, NOTES, STUDIO]);
  });

  it('projects keeps one project with its characters and activities', () => {
    const out = filterFor({ projects: [NOTES], exclude: [] })(sample);
    expect(out.projects.map((p) => p.id)).toEqual([NOTES]);
    expect(out.characters.length).toBeGreaterThan(0);
    expect(out.characters.every((c) => c.projectId === NOTES)).toBe(true);
    const kept = new Set(out.characters.map((c) => c.id));
    expect(out.activities.every((a) => kept.has(a.characterId))).toBe(true);
    expect(out.characters).toEqual(sample.characters.filter((c) => c.projectId === NOTES));
    expectValid(out);
  });

  it('projects matches exactly: a parent folder is no match', () => {
    const out = filterFor({ projects: ['/home/demo/code'], exclude: [] })(sample);
    expect(ids(out)).toEqual({ projects: [], characters: 0, activities: 0 });
    expectValid(out);
  });

  it('exclude drops a project by id', () => {
    const out = filterFor({ projects: [], exclude: ['**/notes-*'] })(sample);
    expect(out.projects.map((p) => p.id)).toEqual([HARBOR, STUDIO]);
    expect(out.characters.every((c) => c.projectId !== NOTES)).toBe(true);
    expectValid(out);
  });

  it('exclude drops characters by cwd, with their children and activities', () => {
    const glob = `${HARBOR}/.claude/worktrees/**`;
    const out = filterFor({ projects: [], exclude: [glob] })(sample);
    expect(out.projects.map((p) => p.id)).toEqual([HARBOR, NOTES, STUDIO]);
    expect(out.characters.some((c) => c.cwd?.includes('/.claude/worktrees/'))).toBe(false);
    expect(out.characters.filter((c) => c.projectId === HARBOR).length).toBeGreaterThan(0);
    const kept = new Set(out.characters.map((c) => c.id));
    expect(out.activities.every((a) => kept.has(a.characterId))).toBe(true);
    expect(out.activities.length).toBeLessThan(sample.activities.length);
    expectValid(out);
  });

  it('drops the descendants of an excluded character whatever their cwd', () => {
    const child = sample.characters.find((c) => c.parentId !== null);
    if (!child?.parentId) throw new Error('the sample has no child character');
    const parent = sample.characters.find((c) => c.id === child.parentId);
    if (!parent?.cwd) throw new Error('the child has no parent with a cwd');
    // The child works elsewhere; only its parent matches the glob.
    const snapshot: Snapshot = {
      ...sample,
      characters: sample.characters.map((c) => (c.id === child.id ? { ...c, cwd: '/home/demo/elsewhere' } : c)),
    };
    const out = filterFor({ projects: [], exclude: [parent.cwd] })(snapshot);
    const kept = new Set(out.characters.map((c) => c.id));
    expect(kept.has(parent.id)).toBe(false);
    expect(kept.has(child.id)).toBe(false);
    expectValid(out);
  });

  it('drops a project left without characters by exclusion', () => {
    // Every notes-app character works in `sub/`; the glob matches those cwds, not the project id.
    const snapshot: Snapshot = {
      ...sample,
      characters: sample.characters.map((c) => (c.projectId === NOTES ? { ...c, cwd: `${NOTES}/sub` } : c)),
    };
    const out = filterFor({ projects: [], exclude: [`${NOTES}/sub`] })(snapshot);
    expect(out.projects.map((p) => p.id)).toEqual([HARBOR, STUDIO]);
    expect(out.characters.every((c) => c.projectId !== NOTES)).toBe(true);
    expectValid(out);
  });

  it('a character with an unknown cwd is kept', () => {
    const snapshot: Snapshot = { ...sample, characters: sample.characters.map((c) => ({ ...c, cwd: null })) };
    const out = filterFor({ projects: [], exclude: ['**/.claude/worktrees/**'] })(snapshot);
    expect(out.characters).toHaveLength(snapshot.characters.length);
    expectValid(out);
  });
});
