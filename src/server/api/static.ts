// Serves the built client (dist/client) in production. Read only.
import { createReadStream, statSync } from 'node:fs';
import { extname, join, relative, resolve, sep, isAbsolute } from 'node:path';
import type { Middleware } from './http.js';

const CONTENT_TYPES: Record<string, string> = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.map': 'application/json; charset=utf-8',
  '.txt': 'text/plain; charset=utf-8',
};

function isFile(path: string): boolean {
  try {
    return statSync(path).isFile();
  } catch {
    return false;
  }
}

function notFound(res: Parameters<Middleware>[1]): void {
  res.writeHead(404, { 'content-type': 'text/plain; charset=utf-8' });
  res.end('Not found');
}

export function serveStatic(dir: string): Middleware {
  const base = resolve(dir);
  return (req, res, next) => {
    if (req.method !== 'GET' && req.method !== 'HEAD') {
      next();
      return;
    }
    let pathname: string;
    try {
      pathname = decodeURIComponent(new URL(req.url ?? '/', 'http://localhost').pathname);
    } catch {
      notFound(res);
      return;
    }
    const target = resolve(base, '.' + pathname);
    const inside = relative(base, target);
    if (inside === '..' || inside.startsWith(`..${sep}`) || isAbsolute(inside) || pathname.includes('\0')) {
      notFound(res);
      return;
    }
    let file = isFile(target) ? target : null;
    if (file === null && pathname.endsWith('/') && isFile(join(target, 'index.html'))) file = join(target, 'index.html');
    if (file === null && extname(pathname) === '' && isFile(join(base, 'index.html'))) file = join(base, 'index.html');
    if (file === null) {
      next();
      return;
    }
    res.writeHead(200, {
      'content-type': CONTENT_TYPES[extname(file).toLowerCase()] ?? 'application/octet-stream',
    });
    if (req.method === 'HEAD') {
      res.end();
      return;
    }
    createReadStream(file).pipe(res);
  };
}
