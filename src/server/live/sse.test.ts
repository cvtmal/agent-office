import { createServer, type Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import sampleJson from '../../../fixtures/snapshots/sample.json' with { type: 'json' };
import { parseSse, readSseUntil } from '../../../test/sse-parse.js';
import type { ServerEvent, Snapshot } from '../../shared/types.js';
import { attachStream, formatEvent } from './sse.js';
import type { LiveSource } from './source.js';

const sample = sampleJson as unknown as Snapshot;

describe('formatEvent', () => {
  it('round-trips each event type through a parser', () => {
    const [character] = sample.characters;
    const [project] = sample.projects;
    if (!character || !project) throw new Error('sample has no character or project');
    const events: ServerEvent[] = [
      { type: 'snapshot', data: sample },
      { type: 'character', data: character },
      { type: 'project', data: project },
    ];
    const text = events.map(formatEvent).join('');
    const parsed = parseSse(text);
    expect(parsed.rest).toBe('');
    expect(parsed.events).toEqual(events.map((e) => ({ type: e.type, data: e.data })));
  });

  it('puts the JSON on one data line', () => {
    const text = formatEvent({ type: 'snapshot', data: sample });
    expect(text.split('\n')).toHaveLength(4);
    expect(text.startsWith('event: snapshot\ndata: {')).toBe(true);
    expect(text.endsWith('\n\n')).toBe(true);
  });
});

describe('attachStream', () => {
  let server: Server;
  let base: string;
  let subscribed = 0;
  let unsubscribed = 0;
  const listeners = new Set<(events: ServerEvent[]) => void>();
  const source: LiveSource = {
    getSnapshot: () => sample,
    subscribe(listener) {
      subscribed++;
      listeners.add(listener);
      return () => {
        unsubscribed++;
        listeners.delete(listener);
      };
    },
    close: async () => undefined,
  };

  beforeAll(async () => {
    server = createServer((_req, res) => attachStream(res, source));
    await new Promise<void>((done) => server.listen(0, '127.0.0.1', done));
    base = `http://127.0.0.1:${String((server.address() as AddressInfo).port)}`;
  });

  afterAll(async () => {
    await new Promise<void>((done) => {
      server.close(() => done());
      server.closeAllConnections();
    });
  });

  it('sends headers, retry and a snapshot, then deltas; a closed response unsubscribes', async () => {
    const res = await fetch(base);
    expect(res.status).toBe(200);
    expect(res.headers.get('content-type')).toBe('text/event-stream; charset=utf-8');
    expect(res.headers.get('cache-control')).toBe('no-store');
    expect(res.headers.get('connection')).toBe('keep-alive');
    const [character] = sample.characters;
    if (!character) throw new Error('sample has no character');
    let sent = false;
    const parsed = await readSseUntil(res, (p) => {
      if (p.events.length >= 1 && !sent) {
        sent = true;
        for (const listener of listeners) listener([{ type: 'character', data: character }]);
      }
      return p.events.length >= 2;
    });
    expect(parsed.retry).toBe(2000);
    expect(parsed.events.map((e) => e.type)).toEqual(['snapshot', 'character']);
    expect(parsed.events[0]?.data).toEqual(sample);
    expect(subscribed).toBe(1);
    await expect.poll(() => unsubscribed).toBe(1);
    expect(listeners.size).toBe(0);
  });
});
