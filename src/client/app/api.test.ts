import { describe, expect, it } from 'vitest';
import sampleJson from '../../../fixtures/snapshots/sample.json';
import { loadSnapshot } from './api.js';
import { createStore } from './store.js';

// Client code has no node:fs (S2), so the fixture comes in as a JSON import.
const sampleText = JSON.stringify(sampleJson);

function fakeFetch(respond: () => Response): typeof fetch {
  return () => Promise.resolve(respond());
}

describe('loadSnapshot', () => {
  it('applies a valid snapshot', async () => {
    const store = createStore();
    await loadSnapshot(store, fakeFetch(() => new Response(sampleText, { status: 200 })));
    expect(store.getState().connection).toBe('ready');
    expect(store.getState().snapshot?.characters).toHaveLength(14);
  });

  it('reports a non-200 response', async () => {
    const store = createStore();
    await loadSnapshot(store, fakeFetch(() => new Response('{"error":"internal"}', { status: 500 })));
    expect(store.getState()).toMatchObject({ connection: 'error', snapshot: null });
    expect(store.getState().error).toContain('500');
  });

  it('reports an invalid body', async () => {
    const store = createStore();
    await loadSnapshot(store, fakeFetch(() => new Response('{"version":1}', { status: 200 })));
    expect(store.getState()).toMatchObject({ connection: 'error', snapshot: null });
    expect(store.getState().error).toContain('invalid snapshot');
  });

  it('reports a network error', async () => {
    const store = createStore();
    await loadSnapshot(store, () => Promise.reject(new Error('offline')));
    expect(store.getState().error).toContain('offline');
  });
});
