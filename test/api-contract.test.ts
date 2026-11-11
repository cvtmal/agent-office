// Contract test for the HTTP API (DATA-7): `/api/snapshot` JSON and the `/api/events` SSE stream
// (a `snapshot` on connect, then deltas; every event passes `validateEvent`).
import { createServer, type Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import { fileURLToPath } from 'node:url';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { FAKE_SECRETS } from '../fixtures/gen/records.js';
import { createRequestHandler, type Middleware } from '../src/server/api/http.js';
import { createLiveSource, type LiveSource } from '../src/server/live/source.js';
import { loadSampleSnapshot } from '../src/server/sample.js';
import type { ServerEvent, Snapshot } from '../src/shared/types.js';
import { isSnapshot, validateEvent, validateSnapshot } from '../src/shared/validate.js';
import { readSseUntil } from './sse-parse.js';

const fallbackSpy = vi.fn<Middleware>((_req, res) => {
  res.writeHead(200, { 'content-type': 'text/plain' });
  res.end('fallback');
});

let server: Server;
let base: string;

beforeAll(async () => {
  server = createServer(createRequestHandler({ getSnapshot: () => loadSampleSnapshot() }, fallbackSpy));
  await new Promise<void>((done) => server.listen(0, '127.0.0.1', done));
  base = `http://127.0.0.1:${String((server.address() as AddressInfo).port)}`;
});

afterAll(async () => {
  await new Promise<void>((done) => {
    server.close(() => done());
    server.closeAllConnections();
  });
});

describe('GET /api/snapshot', () => {
  it('returns a valid snapshot with 14 characters', async () => {
    const res = await fetch(`${base}/api/snapshot`);
    expect(res.status).toBe(200);
    expect(res.headers.get('content-type')).toMatch(/^application\/json/);
    expect(res.headers.get('cache-control')).toBe('no-store');
    const body: unknown = await res.json();
    expect(validateSnapshot(body)).toEqual([]);
    expect((body as Snapshot).characters).toHaveLength(14);
  });
});

describe('other paths', () => {
  it('an unknown /api/ path is a JSON 404', async () => {
    const res = await fetch(`${base}/api/nope`);
    expect(res.status).toBe(404);
    expect(res.headers.get('content-type')).toMatch(/^application\/json/);
    expect(await res.json()).toEqual({ error: 'not found' });
  });

  it('a non-API path goes to the fallback', async () => {
    fallbackSpy.mockClear();
    const res = await fetch(`${base}/`);
    expect(await res.text()).toBe('fallback');
    expect(fallbackSpy).toHaveBeenCalledOnce();
  });
});

describe('GET /api/events', () => {
  it('starts with a valid snapshot event and the SSE headers', async () => {
    const res = await fetch(`${base}/api/events`);
    expect(res.status).toBe(200);
    expect(res.headers.get('content-type')).toBe('text/event-stream; charset=utf-8');
    expect(res.headers.get('cache-control')).toBe('no-store');
    expect(res.headers.get('connection')).toBe('keep-alive');
    const parsed = await readSseUntil(res, (p) => p.events.length >= 1);
    expect(parsed.retry).toBe(2000);
    const [first] = parsed.events;
    expect(first?.type).toBe('snapshot');
    expect(validateEvent(first)).toEqual([]);
    expect(isSnapshot(first?.data)).toBe(true);
    expect((first?.data as Snapshot).characters).toHaveLength(14);
  });

  it('streams the deltas of a source; each one validates', async () => {
    const sample = loadSampleSnapshot();
    const [character] = sample.characters;
    const [activity] = sample.activities;
    if (!character || !activity) throw new Error('sample has no character or activity');
    const listeners = new Set<(events: ServerEvent[]) => void>();
    const source: LiveSource = {
      getSnapshot: () => sample,
      subscribe(listener) {
        listeners.add(listener);
        return () => listeners.delete(listener);
      },
      close: async () => undefined,
    };
    const live = createServer(createRequestHandler({ getSnapshot: source.getSnapshot, source }));
    await new Promise<void>((done) => live.listen(0, '127.0.0.1', done));
    try {
      const res = await fetch(`http://127.0.0.1:${String((live.address() as AddressInfo).port)}/api/events`);
      let sent = false;
      const parsed = await readSseUntil(res, (p) => {
        if (p.events.length >= 1 && !sent) {
          sent = true;
          for (const listener of listeners) {
            listener([
              { type: 'character', data: character },
              { type: 'activity', data: activity },
            ]);
          }
        }
        return p.events.length >= 3;
      });
      expect(parsed.events.map((e) => e.type)).toEqual(['snapshot', 'character', 'activity']);
      for (const e of parsed.events) expect(validateEvent(e)).toEqual([]);
    } finally {
      await new Promise<void>((done) => {
        live.close(() => done());
        live.closeAllConnections();
      });
    }
  });
});

describe('GET /api/events over the fake config dir', () => {
  it('leaks no fake secret through the SSE stream', async () => {
    const source = await createLiveSource({
      cfgDir: fileURLToPath(new URL('../fixtures/transcripts/config', import.meta.url)),
      home: '/home/dev',
      config: { maxAgeHours: Infinity },
      readTable: async () => new Map(),
      rootOf: (cwd) => cwd,
      harness: { read: () => null, watch: () => ({ close: () => undefined }) },
    });
    const live = createServer(createRequestHandler({ getSnapshot: source.getSnapshot, source }));
    await new Promise<void>((done) => live.listen(0, '127.0.0.1', done));
    try {
      const res = await fetch(`http://127.0.0.1:${String((live.address() as AddressInfo).port)}/api/events`);
      const parsed = await readSseUntil(res, (p) => p.events.length >= 1);
      expect(parsed.events[0]?.type).toBe('snapshot');
      const snapshot = parsed.events[0]?.data as Snapshot;
      expect(snapshot.characters.length).toBeGreaterThan(0);
      const text = JSON.stringify(parsed.events);
      for (const secret of FAKE_SECRETS) expect(text).not.toContain(secret);
    } finally {
      await new Promise<void>((done) => {
        live.close(() => done());
        live.closeAllConnections();
      });
      await source.close();
    }
  });
});
