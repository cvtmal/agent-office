// Dev mode on one port: Vite in middleware mode behind our own http server.
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { type RunningServer, startServer } from '../src/server/start.js';

let server: RunningServer;

beforeAll(async () => {
  server = await startServer({ port: 0, dev: true });
}, 30_000);

afterAll(async () => {
  await server.close();
}, 30_000);

describe('startServer({ dev: true })', () => {
  it('serves index.html with the office canvas', { timeout: 30_000 }, async () => {
    const res = await fetch(new URL('/', server.url));
    expect(res.status).toBe(200);
    expect(res.headers.get('content-type')).toMatch(/text\/html/);
    expect(await res.text()).toContain('id="office"');
  });

  it('transforms the client entry', { timeout: 30_000 }, async () => {
    const res = await fetch(new URL('/src/client/main.ts', server.url));
    expect(res.status).toBe(200);
    expect(res.headers.get('content-type')).toMatch(/javascript/);
  });

  it('serves the API on the same port', { timeout: 30_000 }, async () => {
    const res = await fetch(new URL('/api/snapshot', server.url));
    expect(res.status).toBe(200);
  });
});
