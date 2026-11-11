// startServer with an injected source (research R9): the API reads it, close() ends SSE clients
// and closes the source. A temp root with a built client keeps Vite out of the test.
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import sampleJson from '../../fixtures/snapshots/sample.json' with { type: 'json' };
import type { ServerEvent, Snapshot } from '../shared/types.js';
import type { LiveSource } from './live/source.js';
import { startServer } from './start.js';

const sample = sampleJson as unknown as Snapshot;
let root: string;

beforeAll(() => {
  root = mkdtempSync(join(tmpdir(), 'agent-office-start-'));
  mkdirSync(join(root, 'dist', 'client'), { recursive: true });
  writeFileSync(join(root, 'dist', 'client', 'index.html'), '<!doctype html><canvas id="office"></canvas>');
});

afterAll(() => {
  rmSync(root, { recursive: true, force: true });
});

describe('startServer({ source })', () => {
  it('serves source.getSnapshot() and closes cleanly with an open /api/events client', async () => {
    const snapshot: Snapshot = { ...sample, characters: sample.characters.slice(0, 2) };
    const listeners = new Set<(events: ServerEvent[]) => void>();
    let closed = 0;
    const source: LiveSource = {
      getSnapshot: () => snapshot,
      subscribe(listener) {
        listeners.add(listener);
        return () => {
          listeners.delete(listener);
        };
      },
      close: async () => {
        closed++;
      },
    };
    const server = await startServer({ port: 0, dev: false, root, source });

    const res = await fetch(new URL('/api/snapshot', server.url));
    expect(res.status).toBe(200);
    expect(((await res.json()) as Snapshot).characters).toHaveLength(2);

    const events = await fetch(new URL('/api/events', server.url));
    expect(events.status).toBe(200);
    await expect.poll(() => listeners.size).toBe(1);
    const body = events.body?.getReader();
    const drained = (async () => {
      try {
        while (!(await body?.read())?.done);
      } catch {
        // the connection is cut by close()
      }
    })();

    await server.close();
    await drained;
    expect(closed).toBe(1);
    expect(listeners.size).toBe(0);
  });
});
