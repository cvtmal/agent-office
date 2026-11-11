import { describe, expect, it } from 'vitest';
import { mountMotion, type MotionQuery } from './motion.js';
import { createStore } from './store.js';

/** A fake MediaQueryList whose `matches` can be flipped with `set`. */
function fakeQuery(matches: boolean) {
  const listeners = new Set<() => void>();
  const mql = {
    matches,
    addEventListener: (_type: string, fn: () => void) => {
      listeners.add(fn);
    },
    removeEventListener: (_type: string, fn: () => void) => {
      listeners.delete(fn);
    },
    set(next: boolean) {
      mql.matches = next;
      for (const fn of [...listeners]) fn();
    },
    get count() {
      return listeners.size;
    },
  };
  return mql;
}

describe('mountMotion', () => {
  it('takes the initial value of the query', () => {
    const store = createStore();
    mountMotion(store, fakeQuery(true) as unknown as MotionQuery);
    expect(store.getState().ui.reducedMotion).toBe(true);
  });

  it('follows the change event', () => {
    const store = createStore();
    const mql = fakeQuery(false);
    mountMotion(store, mql as unknown as MotionQuery);
    expect(store.getState().ui.reducedMotion).toBe(false);
    mql.set(true);
    expect(store.getState().ui.reducedMotion).toBe(true);
    mql.set(false);
    expect(store.getState().ui.reducedMotion).toBe(false);
  });

  it('the disposer removes the listener', () => {
    const store = createStore();
    const mql = fakeQuery(false);
    const dispose = mountMotion(store, mql as unknown as MotionQuery);
    expect(mql.count).toBe(1);
    dispose();
    expect(mql.count).toBe(0);
    mql.set(true);
    expect(store.getState().ui.reducedMotion).toBe(false);
  });

  it('stays false without matchMedia', () => {
    const store = createStore();
    const dispose = mountMotion(store, null);
    expect(store.getState().ui.reducedMotion).toBe(false);
    dispose();
  });
});
