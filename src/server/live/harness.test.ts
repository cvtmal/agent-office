import { describe, expect, it, vi } from 'vitest';
import type { HarnessExtras } from '../../shared/types.js';
import { createHarnessCache, type HarnessWatch } from './harness.js';

const H = (wave: string): HarnessExtras => ({ lanes: [], ctoGeneration: 1, phase: null, wave, outcomes: [], lastCommit: null });

/** A fake `watch` that records each watcher's callback and close. */
function fakeWatch() {
  const callbacks = new Map<string, (h: HarnessExtras | null) => void>();
  const close = vi.fn();
  const watch = vi.fn<HarnessWatch>((dir, cb) => {
    callbacks.set(dir, cb);
    return { close };
  });
  return { watch, callbacks, close };
}

describe('createHarnessCache', () => {
  it('reads each root once and watches it', () => {
    const read = vi.fn((dir: string) => (dir === '/r/a' ? H('W1') : null));
    const { watch } = fakeWatch();
    const cache = createHarnessCache({ read, watch, onChange: () => undefined });
    expect(cache.harnessOf('/r/a')).toEqual(H('W1'));
    expect(cache.harnessOf('/r/a')).toEqual(H('W1'));
    expect(cache.harnessOf('/r/b')).toBeNull();
    expect(cache.harnessOf('/r/b')).toBeNull();
    expect(read.mock.calls.map((c) => c[0])).toEqual(['/r/a', '/r/b']);
    // also the root without harness files is watched (P-6)
    expect(watch.mock.calls.map((c) => c[0])).toEqual(['/r/a', '/r/b']);
  });

  it('maps a root to its directory', () => {
    const read = vi.fn(() => null);
    const { watch } = fakeWatch();
    const cache = createHarnessCache({ dirOf: (root) => `/copy${root}`, read, watch, onChange: () => undefined });
    cache.harnessOf('/r/a');
    expect(read).toHaveBeenCalledWith('/copy/r/a');
    expect(watch.mock.calls[0]?.[0]).toBe('/copy/r/a');
  });

  it('stores a watched change and reports the root', () => {
    const { watch, callbacks } = fakeWatch();
    const onChange = vi.fn();
    const cache = createHarnessCache({ read: () => null, watch, onChange });
    expect(cache.harnessOf('/r/a')).toBeNull();
    callbacks.get('/r/a')?.(H('W2'));
    expect(onChange).toHaveBeenCalledWith('/r/a');
    expect(cache.harnessOf('/r/a')).toEqual(H('W2'));
  });

  it('closes every watcher', () => {
    const { watch, callbacks, close } = fakeWatch();
    const onChange = vi.fn();
    const cache = createHarnessCache({ read: () => null, watch, onChange });
    cache.harnessOf('/r/a');
    cache.harnessOf('/r/b');
    cache.close();
    expect(close).toHaveBeenCalledTimes(2);
    callbacks.get('/r/a')?.(H('W3'));
    expect(onChange).not.toHaveBeenCalled();
  });
});
