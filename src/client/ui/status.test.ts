import { describe, expect, it } from 'vitest';
import sampleJson from '../../../fixtures/snapshots/sample.json';
import type { Snapshot } from '../../shared/types.js';
import { createStore, initialState } from '../app/store.js';
import { latestActivityAt, mountStatus, statusText } from './status.js';

const sample = sampleJson as unknown as Snapshot;

describe('statusText', () => {
  it('shows loading before the first snapshot', () => {
    expect(statusText(initialState())).toBe('Agent Office · loading');
  });

  it('counts characters', () => {
    expect(statusText({ ...initialState(), snapshot: sample, connection: 'ready' })).toBe(
      'Agent Office · 14 characters',
    );
  });

  it('shows reconnecting before any snapshot', () => {
    expect(statusText({ ...initialState(), connection: 'reconnecting' })).toBe('Agent Office · reconnecting');
  });

  it('keeps the count while reconnecting with a snapshot', () => {
    expect(statusText({ ...initialState(), snapshot: sample, connection: 'reconnecting' })).toBe(
      'Agent Office · 14 characters · reconnecting',
    );
  });

  it('shows the error', () => {
    expect(statusText({ ...initialState(), connection: 'error', error: 'offline' })).toBe('Agent Office · offline');
  });
});

// Minimal stand-in for the two DOM calls mountStatus makes (tests run in node).
interface FakeNode {
  className: string;
  textContent: string;
}

function fakeHost(): { el: HTMLElement; children: FakeNode[]; app: HTMLElement } {
  const children: FakeNode[] = [];
  const el = {
    ownerDocument: { createElement: (): FakeNode => ({ className: '', textContent: '' }) },
    append: (child: FakeNode) => children.push(child),
  };
  const app = { dataset: {} as Record<string, string> };
  return { el: el as unknown as HTMLElement, children, app: app as unknown as HTMLElement };
}

describe('mountStatus', () => {
  it('writes into one owned span and leaves the host alone', () => {
    const { el, children, app } = fakeHost();
    const store = createStore();
    mountStatus(el, store, app);
    expect(children).toHaveLength(1);
    expect(children[0]).toEqual({ className: 'status', textContent: 'Agent Office · loading' });

    store.applySnapshot(sample);
    expect(children).toHaveLength(1);
    expect(children[0]?.textContent).toBe('Agent Office · 14 characters');
    expect(app.dataset['connection']).toBe('ready');

    store.setConnection('reconnecting');
    expect(children[0]?.textContent).toBe('Agent Office · 14 characters · reconnecting');
    expect(app.dataset['connection']).toBe('reconnecting');
  });
});

describe('mountStatus generatedAt mirror', () => {
  it('mirrors snapshot.generatedAt into #app[data-generated-at] once a snapshot arrives', () => {
    const { el, app } = fakeHost();
    const store = createStore();
    mountStatus(el, store, app);
    expect(app.dataset['generatedAt']).toBeUndefined();

    store.applySnapshot(sample);
    expect(app.dataset['generatedAt']).toBe(sample.generatedAt);

    const later = { ...sample, generatedAt: '2026-01-01T00:00:05.000Z' };
    store.applySnapshot(later);
    expect(app.dataset['generatedAt']).toBe(later.generatedAt);

    store.setConnection('reconnecting');
    expect(app.dataset['generatedAt']).toBe(later.generatedAt);
  });
});

describe('latestActivityAt', () => {
  it('is null without a snapshot or without activities', () => {
    expect(latestActivityAt(initialState())).toBeNull();
    const quiet = { ...sample, characters: sample.characters.map((c) => ({ ...c, lastActivityAt: null })) };
    expect(latestActivityAt({ ...initialState(), snapshot: quiet })).toBeNull();
  });

  it('is the latest lastActivityAt across characters', () => {
    const times = sample.characters.map((c) => c.lastActivityAt).filter((t): t is string => t !== null);
    expect(times.length).toBeGreaterThan(0);
    expect(latestActivityAt({ ...initialState(), snapshot: sample })).toBe([...times].sort().at(-1));
  });
});

describe('mountStatus last-activity mirror', () => {
  it('mirrors the latest activity time into #app[data-last-activity-at] on a character delta', () => {
    const { el, app } = fakeHost();
    const store = createStore();
    mountStatus(el, store, app);
    expect(app.dataset['lastActivityAt']).toBeUndefined();

    store.applySnapshot(sample);
    expect(app.dataset['lastActivityAt']).toBe(latestActivityAt(store.getState()));

    // A character delta keeps generatedAt but moves the latest activity time.
    const [first, ...rest] = sample.characters;
    if (first === undefined) throw new Error('sample has no characters');
    const later = '2099-01-01T00:00:00.000Z';
    store.applySnapshot({ ...sample, characters: [{ ...first, lastActivityAt: later }, ...rest] });
    expect(app.dataset['generatedAt']).toBe(sample.generatedAt);
    expect(app.dataset['lastActivityAt']).toBe(later);
  });
});
