// The API routes. One line per route: later cycles append a line each.
import type { IncomingMessage, ServerResponse } from 'node:http';
import type { Snapshot } from '../../shared/types.js';
import { attachStream } from '../live/sse.js';
import { type LiveSource, staticSource } from '../live/source.js';
import { sendJson } from './http.js';

export interface RouteDeps {
  getSnapshot(): Snapshot;
  /** The stream behind `/api/events`; absent: a static stream of `getSnapshot()`. */
  source?: LiveSource;
}

export type Handler = (req: IncomingMessage, res: ServerResponse, deps: RouteDeps) => void | Promise<void>;

export const routes: { method: 'GET'; path: string; handler: Handler }[] = [
  { method: 'GET', path: '/api/snapshot', handler: (_q, res, d) => sendJson(res, 200, d.getSnapshot()) },
  { method: 'GET', path: '/api/events', handler: (_q, res, d) => attachStream(res, d.source ?? staticSource(d.getSnapshot())) },
];
