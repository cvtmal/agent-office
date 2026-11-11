import { describe, expect, it } from 'vitest';
import sampleJson from '../../../fixtures/snapshots/sample.json';
import type { Snapshot } from '../../shared/types.js';
import { nextTab, tabModel } from './tabs.js';

const sample = sampleJson as unknown as Snapshot;
const [harbor, notes, studio] = sample.projects;
if (!harbor || !notes || !studio) throw new Error('the sample needs three projects');

describe('tabModel', () => {
  it('is hidden without a snapshot', () => {
    expect(tabModel(null, null)).toEqual({ visible: false, tabs: [] });
  });

  it('is hidden with one project', () => {
    const one: Snapshot = { ...sample, projects: [harbor] };
    expect(tabModel(one, null)).toEqual({ visible: false, tabs: [{ id: harbor.id, label: 'harbor', active: true }] });
  });

  it('shows one tab per project, the first active by default', () => {
    expect(tabModel(sample, null)).toEqual({
      visible: true,
      tabs: [
        { id: harbor.id, label: 'harbor', active: true },
        { id: notes.id, label: 'notes-app', active: false },
        { id: studio.id, label: 'studio', active: false },
      ],
    });
  });

  it('marks the selected project active', () => {
    expect(tabModel(sample, notes.id).tabs.map((t) => t.active)).toEqual([false, true, false]);
  });

  it('falls back to the first project for a stale id', () => {
    expect(tabModel(sample, 'gone').tabs.map((t) => t.active)).toEqual([true, false, false]);
  });
});

describe('nextTab', () => {
  const ids = ['a', 'b', 'c'];

  it.each([
    ['ArrowRight', 'a', 'b'],
    ['ArrowRight', 'c', 'a'],
    ['ArrowLeft', 'b', 'a'],
    ['ArrowLeft', 'a', 'c'],
    ['Home', 'b', 'a'],
    ['End', 'a', 'c'],
  ])('%s from %s -> %s', (key, from, to) => {
    expect(nextTab(ids, from, key)).toBe(to);
  });

  it('returns null for an unknown key or no tabs', () => {
    expect(nextTab(ids, 'a', 'Enter')).toBeNull();
    expect(nextTab(ids, 'a', 'ArrowDown')).toBeNull();
    expect(nextTab([], null, 'ArrowRight')).toBeNull();
  });

  it('starts at the ends without a current tab', () => {
    expect(nextTab(ids, null, 'ArrowRight')).toBe('a');
    expect(nextTab(ids, 'gone', 'ArrowLeft')).toBe('c');
  });
});
