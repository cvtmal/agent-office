// Starts the one HTTP server: the API, plus either Vite in middleware mode
// (dev, HMR on the same port) or the built client from dist/client.
import { existsSync } from 'node:fs';
import { createServer, type Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import { join } from 'node:path';
import type { Snapshot } from '../shared/types.js';
import { createRequestHandler, type Middleware } from './api/http.js';
import { serveStatic } from './api/static.js';
import { REPO_ROOT } from './paths.js';
import { loadSampleSnapshot } from './sample.js';

export class PortInUseError extends Error {
  readonly port: number;

  constructor(port: number) {
    super(`port ${String(port)} is in use`);
    this.name = 'PortInUseError';
    this.port = port;
  }
}

export interface StartOptions {
  port: number;
  host?: string;
  dev: boolean;
  root?: string;
  getSnapshot?: () => Snapshot;
}

export interface RunningServer {
  url: string;
  port: number;
  close(): Promise<void>;
}

export async function startServer(options: StartOptions): Promise<RunningServer> {
  const { port, host = '127.0.0.1', root = REPO_ROOT } = options;
  let getSnapshot = options.getSnapshot;
  if (!getSnapshot) {
    const snapshot = loadSampleSnapshot(root);
    getSnapshot = () => snapshot;
  }

  // The server exists before Vite so Vite can attach HMR to it; the request
  // handler is set once the fallback is known (before listen).
  let requestHandler = createRequestHandler({ getSnapshot });
  const httpServer: Server = createServer((req, res) => requestHandler(req, res));

  let fallback: Middleware;
  let closeVite: (() => Promise<void>) | undefined;
  const clientDir = join(root, 'dist', 'client');
  let dev = options.dev;
  if (!dev && !existsSync(join(clientDir, 'index.html'))) {
    console.log('dist/client missing, serving in dev mode');
    dev = true;
  }
  if (dev) {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      root,
      configFile: join(root, 'vite.config.ts'),
      appType: 'spa',
      server: { middlewareMode: true, ws: { server: httpServer } },
    });
    fallback = vite.middlewares;
    closeVite = () => vite.close();
  } else {
    fallback = serveStatic(clientDir);
  }
  requestHandler = createRequestHandler({ getSnapshot }, fallback);

  try {
    await new Promise<void>((resolve, reject) => {
      httpServer.once('error', (error: NodeJS.ErrnoException) => {
        reject(error.code === 'EADDRINUSE' ? new PortInUseError(port) : error);
      });
      httpServer.listen(port, host, () => resolve());
    });
  } catch (error) {
    await closeVite?.();
    throw error;
  }

  const actual = (httpServer.address() as AddressInfo).port;
  return {
    url: `http://${host}:${String(actual)}/`,
    port: actual,
    async close() {
      await closeVite?.();
      await new Promise<void>((resolve) => {
        httpServer.close(() => resolve());
        httpServer.closeAllConnections();
      });
    },
  };
}
