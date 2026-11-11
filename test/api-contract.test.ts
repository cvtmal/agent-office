// Contract test for the HTTP API (DATA-7). SSE arrives in cycle #3.
import { createServer, type Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { createRequestHandler, type Middleware } from '../src/server/api/http.js';
import { loadSampleSnapshot } from '../src/server/sample.js';
import type { Snapshot } from '../src/shared/types.js';
import { validateSnapshot } from '../src/shared/validate.js';

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
  await new Promise<void>((done) => server.close(() => done()));
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
