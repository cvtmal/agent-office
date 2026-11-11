// The SSE wire for `GET /api/events` (research R12): a `snapshot` on connect, then every delta of
// the source, `: ping` every 15 s. No `id:`: every connect starts from a fresh snapshot.
import type { ServerResponse } from 'node:http';
import type { ServerEvent } from '../../shared/types.js';
import type { LiveSource } from './source.js';

/** How often a comment line keeps idle connections (and proxies) open. */
const PING_MS = 15_000;

/** One event in SSE framing: `event: <type>`, one `data:` line of JSON, a blank line. */
export function formatEvent(e: ServerEvent): string {
  return `event: ${e.type}\ndata: ${JSON.stringify(e.data)}\n\n`;
}

/** Streams `source` to `res` until the client goes away. */
export function attachStream(res: ServerResponse, source: LiveSource): void {
  res.writeHead(200, {
    'content-type': 'text/event-stream; charset=utf-8',
    'cache-control': 'no-store',
    connection: 'keep-alive',
  });
  res.flushHeaders();
  res.write('retry: 2000\n\n');
  res.write(formatEvent({ type: 'snapshot', data: source.getSnapshot() }));
  const unsubscribe = source.subscribe((events) => {
    for (const e of events) res.write(formatEvent(e));
  });
  const ping = setInterval(() => res.write(': ping\n\n'), PING_MS);
  ping.unref();
  res.on('close', () => {
    clearInterval(ping);
    unsubscribe();
  });
}
