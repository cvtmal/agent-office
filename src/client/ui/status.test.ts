import { describe, expect, it } from 'vitest';
import sampleJson from '../../../fixtures/snapshots/sample.json';
import type { Snapshot } from '../../shared/types.js';
import { createStore, initialState } from '../app/store.js';
import { mountStatus, statusText } from './status.js';

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
  });
});
