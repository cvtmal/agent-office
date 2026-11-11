// The request handler: API routes first, then a fallback (static files or
// Vite) for everything that is not under /api/.
import type { IncomingMessage, ServerResponse } from 'node:http';
import { type RouteDeps, routes } from './routes.js';

export type Middleware = (req: IncomingMessage, res: ServerResponse, next: () => void) => void;

export function sendJson(res: ServerResponse, status: number, body: unknown): void {
  const text = JSON.stringify(body);
  res.writeHead(status, {
    'content-type': 'application/json; charset=utf-8',
    'cache-control': 'no-store',
    'content-length': Buffer.byteLength(text),
  });
  res.end(text);
}

function notFound(res: ServerResponse): void {
  res.writeHead(404, { 'content-type': 'text/plain; charset=utf-8' });
  res.end('Not found');
}

export function createRequestHandler(
  deps: RouteDeps,
  fallback?: Middleware,
): (req: IncomingMessage, res: ServerResponse) => void {
  return (req, res) => {
    const pathname = new URL(req.url ?? '/', 'http://localhost').pathname;
    const route = routes.find((r) => r.method === req.method && r.path === pathname);
    if (route) {
      const fail = (error: unknown): void => {
        console.error(error);
        if (!res.headersSent) sendJson(res, 500, { error: 'internal' });
        else res.end();
      };
      try {
        const result = route.handler(req, res, deps);
        if (result instanceof Promise) result.catch(fail);
      } catch (error) {
        fail(error);
      }
      return;
    }
    if (pathname === '/api' || pathname.startsWith('/api/')) {
      sendJson(res, 404, { error: 'not found' });
      return;
    }
    if (fallback) fallback(req, res, () => notFound(res));
    else notFound(res);
  };
}
