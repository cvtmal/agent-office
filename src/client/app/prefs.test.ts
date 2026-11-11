import { describe, expect, it } from 'vitest';
import { loadPrefs, mountPrefs, parsePrefs, PREFS_KEY, savePrefs } from './prefs.js';
import { createStore, initialState } from './store.js';

/** In-memory storage that counts writes. */
function fakeStorage(initial: Record<string, string> = {}) {
  const data = new Map(Object.entries(initial));
  let writes = 0;
  return {
    getItem: (key: string) => data.get(key) ?? null,
    setItem: (key: string, value: string) => {
      writes += 1;
      data.set(key, value);
    },
    get writes() {
      return writes;
    },
    raw: () => data.get(PREFS_KEY) ?? null,
  };
}

const throwing = {
  getItem: (): string | null => {
    throw new Error('blocked');
  },
  setItem: (): void => {
    throw new Error('blocked');
  },
};

describe('parsePrefs', () => {
  it('returns nothing for null, invalid JSON or a wrong version', () => {
    expect(parsePrefs(null)).toEqual({});
    expect(parsePrefs('{nope')).toEqual({});
    expect(parsePrefs('42')).toEqual({});
    expect(parsePrefs(JSON.stringify({ v: 2, paused: true }))).toEqual({});
  });

  it('keeps valid fields and drops invalid ones', () => {
    const raw = JSON.stringify({ v: 1, zoom: 5, paused: 'true', sound: true, hideEnded: 1, activeProjectId: 7 });
    expect(parsePrefs(raw)).toEqual({ sound: true });
  });

  it('accepts zoom null and every zoom step', () => {
    expect(parsePrefs(JSON.stringify({ v: 1, zoom: null }))).toEqual({ zoom: null });
    expect(parsePrefs(JSON.stringify({ v: 1, zoom: 3, activeProjectId: null }))).toEqual({
      zoom: 3,
      activeProjectId: null,
    });
  });
});

describe('loadPrefs / savePrefs', () => {
  it('round-trips the saved fields only', () => {
    const storage = fakeStorage();
    const ui = {
      ...initialState().ui,
      selectedId: 'x',
      reducedMotion: true,
      zoom: 2,
      paused: true,
      sound: true,
      hideEnded: true,
      activeProjectId: 'p',
    };
    savePrefs(storage, ui);
    expect(loadPrefs(storage)).toEqual({ zoom: 2, paused: true, sound: true, hideEnded: true, activeProjectId: 'p' });
    expect(storage.raw()).not.toContain('selectedId');
    expect(storage.raw()).not.toContain('reducedMotion');
  });

  it('never throws on a throwing or missing storage', () => {
    expect(loadPrefs(throwing)).toEqual({});
    expect(() => {
      savePrefs(throwing, initialState().ui);
    }).not.toThrow();
    expect(loadPrefs(null)).toEqual({});
    expect(() => {
      savePrefs(null, initialState().ui);
    }).not.toThrow();
  });
});

describe('mountPrefs', () => {
  it('applies stored prefs with one setUi and keeps defaults for invalid fields', () => {
    const storage = fakeStorage({ [PREFS_KEY]: JSON.stringify({ v: 1, zoom: 5, paused: true }) });
    const store = createStore();
    let calls = 0;
    store.subscribe(() => {
      calls += 1;
    });
    mountPrefs(store, storage);
    expect(calls).toBe(1);
    expect(store.getState().ui).toMatchObject({ zoom: null, paused: true, sound: false });
  });

  it('saves only when a saved field changes', () => {
    const storage = fakeStorage();
    const store = createStore();
    const dispose = mountPrefs(store, storage);
    expect(storage.writes).toBe(0);
    store.setUi({ selectedId: 'x' });
    store.setUi({ reducedMotion: true });
    expect(storage.writes).toBe(0);
    store.setUi({ hideEnded: true });
    expect(storage.writes).toBe(1);
    store.setUi({ hideEnded: true });
    expect(storage.writes).toBe(1);
    dispose();
    store.setUi({ sound: true });
    expect(storage.writes).toBe(1);
  });

  it('survives a throwing storage', () => {
    const store = createStore();
    expect(() => {
      mountPrefs(store, throwing);
      store.setUi({ paused: true });
    }).not.toThrow();
  });
});
