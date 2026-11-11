// The live connection (UI-4, research R13): one EventSource on /api/events. Every connection starts
// from its `snapshot`; deltas are folded with applyEvent and reach the store once per animation
// frame. On `error` the EventSource is closed and reopened with our own backoff (1, 2, 4, 8, 15 s,
// capped at 15 s, reset by a received snapshot) instead of EventSource's fixed retry.
import type { ServerEvent, ServerEventType, Snapshot } from '../../shared/types.js';
import { validateEvent } from '../../shared/validate.js';
import { applyEvent } from './apply.js';
import type { Store } from './store.js';

export const EVENTS_URL = '/api/events';
export const RECONNECT_DELAYS: readonly number[] = [1000, 2000, 4000, 8000, 15000];

const EVENT_TYPES: readonly ServerEventType[] = ['snapshot', 'character', 'activity', 'project'];

/** The part of EventSource the connection uses (tests pass a fake). */
export interface EventSourceLike {
  addEventListener(type: string, listener: (ev: MessageEvent<string>) => void): void;
  close(): void;
}

export interface LiveOptions {
  url?: string;
  EventSourceImpl?: new (url: string) => EventSourceLike;
  delays?: readonly number[];
  setTimer?: (fn: () => void, ms: number) => unknown;
  frame?: (fn: () => void) => unknown;
}

export interface LiveConnection {
  close(): void;
}

export function connectLive(store: Store, opts: LiveOptions = {}): LiveConnection {
  const url = opts.url ?? EVENTS_URL;
  const EventSourceImpl = opts.EventSourceImpl ?? EventSource;
  const delays = opts.delays ?? RECONNECT_DELAYS;
  const setTimer = opts.setTimer ?? ((fn: () => void, ms: number) => setTimeout(fn, ms));
  const frame = opts.frame ?? ((fn: () => void) => requestAnimationFrame(fn));

  let es: EventSourceLike | null = null;
  let closed = false;
  let attempt = 0;
  // Events since the last flush, folded onto the store's snapshot; null = nothing pending.
  let pending: Snapshot | null = null;
  let scheduled = false;

  const flush = (): void => {
    scheduled = false;
    if (closed || pending === null) return;
    const next = pending;
    pending = null;
    store.applySnapshot(next);
  };

  const receive = (e: ServerEvent): void => {
    const base = pending ?? store.getState().snapshot;
    const next = applyEvent(base, e);
    if (next === null || next === base) return;
    pending = next;
    if (!scheduled) {
      scheduled = true;
      frame(flush);
    }
  };

  const open = (): void => {
    const source = new EventSourceImpl(url);
    es = source;
    // A delta before this connection's snapshot would land on the previous connection's data.
    let started = false;

    for (const type of EVENT_TYPES) {
      source.addEventListener(type, (ev) => {
        if (closed || es !== source) return;
        let event: unknown;
        try {
          event = { type, data: JSON.parse(ev.data) as unknown };
        } catch {
          console.warn(`agent-office: ${type} event is not JSON`);
          return;
        }
        const errors = validateEvent(event);
        if (errors.length > 0) {
          console.warn(`agent-office: invalid ${type} event: ${errors.join('; ')}`);
          return;
        }
        if (type === 'snapshot') {
          started = true;
          attempt = 0;
          pending = null;
        } else if (!started) {
          return;
        }
        receive(event as ServerEvent);
      });
    }

    source.addEventListener('error', () => {
      if (closed || es !== source) return;
      source.close();
      es = null;
      pending = null; // the next connection starts from its own snapshot
      store.setConnection('reconnecting');
      const delay = delays[Math.min(attempt, delays.length - 1)] ?? 0;
      attempt += 1;
      setTimer(() => {
        if (!closed) open();
      }, delay);
    });
  };

  open();

  return {
    close() {
      closed = true;
      pending = null;
      es?.close();
      es = null;
    },
  };
}
