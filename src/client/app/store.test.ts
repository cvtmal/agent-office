import { describe, expect, it, vi } from 'vitest';
import sampleJson from '../../../fixtures/snapshots/sample.json';
import type { Snapshot } from '../../shared/types.js';
import { createStore } from './store.js';

// Client code has no node:fs (S2), so the fixture comes in as a JSON import.
const sample = sampleJson as unknown as Snapshot;

describe('createStore', () => {
  it('starts loading with no snapshot', () => {
    const state = createStore().getState();
    expect(state).toEqual({ snapshot: null, connection: 'loading', error: null, ui: { selectedId: null, activeProjectId: null } });
  });

  it('notifies subscribers on each change with a new state object', () => {
    const store = createStore();
    const fn = vi.fn();
    store.subscribe(fn);
    const before = store.getState();
    store.setUi({ selectedId: 'x' });
    store.setConnection('error', 'boom');
    expect(fn).toHaveBeenCalledTimes(2);
    expect(store.getState()).not.toBe(before);
    expect(store.getState().ui.selectedId).toBe('x');
    expect(store.getState().error).toBe('boom');
  });

  it('unsubscribe stops notifications', () => {
    const store = createStore();
    const fn = vi.fn();
    const unsubscribe = store.subscribe(fn);
    unsubscribe();
    store.setUi({ selectedId: 'x' });
    expect(fn).not.toHaveBeenCalled();
  });

  it('applySnapshot stores the snapshot and sets connection ready', () => {
    const store = createStore();
    store.setConnection('error', 'old');
    store.applySnapshot(sample);
    expect(store.getState()).toMatchObject({ snapshot: sample, connection: 'ready', error: null });
  });

  it('setConnection reconnecting keeps the snapshot', () => {
    const store = createStore();
    store.applySnapshot(sample);
    store.setConnection('reconnecting');
    expect(store.getState()).toMatchObject({ snapshot: sample, connection: 'reconnecting', error: null });
  });
});
