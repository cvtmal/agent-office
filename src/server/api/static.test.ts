import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { createServer, type Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { serveStatic } from './static.js';

const tmp = mkdtempSync(join(tmpdir(), 'agent-office-static-'));
const dir = join(tmp, 'client');
let server: Server;
let base: string;

beforeAll(async () => {
  mkdirSync(join(dir, 'assets'), { recursive: true });
  writeFileSync(join(dir, 'index.html'), '<!doctype html><title>index</title>');
  writeFileSync(join(dir, 'assets', 'app.js'), 'console.log(1);');
  writeFileSync(join(tmp, 'package.json'), '{"secret":true}');
  const middleware = serveStatic(dir);
  server = createServer((req, res) =>
    middleware(req, res, () => {
      res.writeHead(404);
      res.end('next');
    }),
  );
  await new Promise<void>((done) => server.listen(0, '127.0.0.1', done));
  base = `http://127.0.0.1:${String((server.address() as AddressInfo).port)}`;
});

afterAll(async () => {
  await new Promise<void>((done) => server.close(() => done()));
  rmSync(tmp, { recursive: true, force: true });
});

/** Sends the path as written, without URL normalisation by fetch. */
async function rawGet(path: string): Promise<{ status: number; body: string }> {
  const { request } = await import('node:http');
  const { port } = server.address() as AddressInfo;
  return new Promise((done, fail) => {
    const req = request({ host: '127.0.0.1', port, path, method: 'GET' }, (res) => {
      let body = '';
      res.setEncoding('utf8');
      res.on('data', (chunk: string) => (body += chunk));
      res.on('end', () => done({ status: res.statusCode ?? 0, body }));
    });
    req.on('error', fail);
    req.end();
  });
}

describe('serveStatic', () => {
  it('serves a file with its content type', async () => {
    const res = await fetch(`${base}/assets/app.js`);
    expect(res.status).toBe(200);
    expect(res.headers.get('content-type')).toMatch(/^text\/javascript/);
    expect(await res.text()).toBe('console.log(1);');
  });

  it('serves index.html for /', async () => {
    const res = await fetch(`${base}/`);
    expect(res.headers.get('content-type')).toMatch(/^text\/html/);
    expect(await res.text()).toContain('<title>index</title>');
  });

  it('falls back to index.html for a path without extension', async () => {
    const res = await fetch(`${base}/some/route`);
    expect(res.status).toBe(200);
    expect(await res.text()).toContain('<title>index</title>');
  });

  it('calls next for a missing file with an extension', async () => {
    const res = await fetch(`${base}/missing.png`);
    expect(res.status).toBe(404);
    expect(await res.text()).toBe('next');
  });

  it.each(['/../package.json', '/..%2fpackage.json', '/%2e%2e/package.json', '/assets/../../package.json'])(
    'does not serve %s',
    async (path) => {
      const res = await rawGet(path);
      expect(res.status).toBe(404);
      expect(res.body).not.toContain('secret');
    },
  );
});
