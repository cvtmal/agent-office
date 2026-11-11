import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import sampleJson from '../../../fixtures/snapshots/sample.json';
import type { Activity, Snapshot } from '../../shared/types.js';
import { connectLive, type EventSourceLike } from './live.js';
import { createStore } from './store.js';

const sample = sampleJson as unknown as Snapshot;
const firstCharacter = sample.characters[0];
if (!firstCharacter) throw new Error('sample has no characters');

class FakeEventSource implements EventSourceLike {
  static instances: FakeEventSource[] = [];
  readonly listeners = new Map<string, ((ev: MessageEvent<string>) => void)[]>();
  closed = false;

  constructor(readonly url: string) {
    FakeEventSource.instances.push(this);
  }

  addEventListener(type: string, listener: (ev: MessageEvent<string>) => void): void {
    this.listeners.set(type, [...(this.listeners.get(type) ?? []), listener]);
  }

  close(): void {
    this.closed = true;
  }

  emit(type: string, data: unknown): void {
    const ev = { data: typeof data === 'string' ? data : JSON.stringify(data) } as MessageEvent<string>;
    for (const fn of this.listeners.get(type) ?? []) fn(ev);
  }

  fail(): void {
    for (const fn of this.listeners.get('error') ?? []) fn({} as MessageEvent<string>);
  }
}

function latest(): FakeEventSource {
  const es = FakeEventSource.instances.at(-1);
  if (!es) throw new Error('no EventSource opened');
  return es;
}

function activity(i: number): Activity {
  return {
    characterId: firstCharacter?.id ?? '',
    at: `2099-01-01T00:00:${String(i).padStart(2, '0')}Z`,
    tool: 'Read',
    kind: 'read',
    target: `f${String(i)}.ts`,
  };
}

describe('connectLive', () => {
  let frames: (() => void)[];
  const runFrame = (): void => {
    const due = frames;
    frames = [];
    for (const fn of due) fn();
  };
  const connect = (store = createStore()) => {
    const live = connectLive(store, {
      EventSourceImpl: FakeEventSource,
      setTimer: (fn, ms) => setTimeout(fn, ms),
      frame: (fn) => frames.push(fn),
    });
    return { store, live };
  };

  beforeEach(() => {
    vi.useFakeTimers();
    FakeEventSource.instances = [];
    frames = [];
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it('opens /api/events and is ready after the first snapshot', () => {
    const { store } = connect();
    expect(latest().url).toBe('/api/events');
    expect(store.getState().connection).toBe('loading');
    latest().emit('snapshot', sample);
    runFrame();
    expect(store.getState()).toMatchObject({ connection: 'ready', snapshot: sample });
  });

  it('on error closes, reports reconnecting and retries at 1, 2, 4, 8, 15, 15 s', () => {
    const { store } = connect();
    latest().emit('snapshot', sample);
    runFrame();

    for (const delay of [1000, 2000, 4000, 8000, 15000, 15000]) {
      const before = latest();
      before.fail();
      expect(before.closed).toBe(true);
      expect(store.getState().connection).toBe('reconnecting');
      expect(store.getState().snapshot).toEqual(sample); // the last snapshot stays on screen
      const count = FakeEventSource.instances.length;
      vi.advanceTimersByTime(delay - 1);
      expect(FakeEventSource.instances).toHaveLength(count);
      vi.advanceTimersByTime(1);
      expect(FakeEventSource.instances).toHaveLength(count + 1);
    }
  });

  it('a snapshot resets the backoff', () => {
    const { store } = connect();
    latest().fail();
    vi.advanceTimersByTime(1000);
    latest().fail();
    vi.advanceTimersByTime(2000);
    latest().emit('snapshot', sample);
    runFrame();
    expect(store.getState().connection).toBe('ready');

    latest().fail();
    const count = FakeEventSource.instances.length;
    vi.advanceTimersByTime(1000);
    expect(FakeEventSource.instances).toHaveLength(count + 1);
  });

  it('ten deltas in one frame reach the store as one applySnapshot', () => {
    const { store } = connect();
    latest().emit('snapshot', sample);
    runFrame();
    const spy = vi.spyOn(store, 'applySnapshot');
    for (let i = 0; i < 10; i++) latest().emit('activity', activity(i));
    expect(spy).not.toHaveBeenCalled();
    runFrame();
    expect(spy).toHaveBeenCalledTimes(1);
    const own = store.getState().snapshot?.activities.filter((a) => a.characterId === firstCharacter.id) ?? [];
    expect(own.map((a) => a.target)).toEqual(Array.from({ length: 10 }, (_, i) => `f${String(i)}.ts`));
  });

  it('invalid events are warned about and skipped', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    const { store } = connect();
    latest().emit('snapshot', '{not json');
    latest().emit('snapshot', { version: 999 });
    runFrame();
    expect(warn).toHaveBeenCalledTimes(2);
    expect(store.getState().snapshot).toBeNull();
  });

  it('a new connection starts from its own snapshot', () => {
    const { store } = connect();
    latest().emit('snapshot', sample);
    runFrame();
    const shown = store.getState().snapshot;
    latest().emit('activity', activity(1));
    latest().fail(); // pending delta of the old connection is dropped
    runFrame();
    expect(store.getState().snapshot).toBe(shown);

    vi.advanceTimersByTime(1000);
    latest().emit('activity', activity(2)); // before this connection's snapshot: ignored
    runFrame();
    expect(store.getState().snapshot).toBe(shown);

    const fresh = { ...sample, characters: sample.characters.slice(0, 1), activities: [] };
    latest().emit('snapshot', fresh);
    runFrame();
    expect(store.getState()).toMatchObject({ connection: 'ready', snapshot: fresh });
    expect(store.getState().snapshot?.characters).toHaveLength(1);
  });

  it('close() stops reconnecting', () => {
    const { live } = connect();
    latest().fail();
    live.close();
    vi.advanceTimersByTime(60_000);
    expect(FakeEventSource.instances).toHaveLength(1);
  });
});
