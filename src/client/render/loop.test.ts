import { describe, expect, it } from 'vitest';
import { startLoop, type LoopClock } from './loop.js';
import { FrameStats } from './stats.js';

/** A fake clock: frames run only when the test calls `fire(t)`. */
function fakeClock(cpuMsPerFrame = 0): LoopClock & { fire(t: number): void; pending: number } {
  let cbs = new Map<number, (t: number) => void>();
  let next = 1;
  let cpu = 0;
  return {
    now: () => (cpu += cpuMsPerFrame),
    requestFrame(cb) {
      cbs.set(next, cb);
      return next++;
    },
    cancelFrame(h) {
      cbs.delete(h);
    },
    fire(t) {
      const due = cbs;
      cbs = new Map();
      for (const cb of due.values()) cb(t);
    },
    get pending() {
      return cbs.size;
    },
  };
}

function counting(clock: ReturnType<typeof fakeClock>, extra: { onSecond?: () => void } = {}) {
  const calls = { updates: [] as number[], draws: [] as number[], seconds: 0 };
  const stop = startLoop(
    {
      update: (dt) => calls.updates.push(dt),
      draw: (t) => calls.draws.push(t),
      onSecond: () => {
        calls.seconds++;
        extra.onSecond?.();
      },
    },
    clock,
  );
  return { calls, stop };
}

describe('startLoop', () => {
  it('runs 3 fixed 60 Hz updates for 50 ms and draws once per frame', () => {
    const clock = fakeClock();
    const { calls } = counting(clock);
    clock.fire(1000);
    expect(calls.updates).toHaveLength(0);
    clock.fire(1050);
    expect(calls.updates).toHaveLength(3);
    expect(calls.updates[0]).toBeCloseTo(1000 / 60);
    expect(calls.draws).toEqual([1000, 1050]);
  });

  it('carries the remainder to the next frame', () => {
    const clock = fakeClock();
    const { calls } = counting(clock);
    clock.fire(0);
    clock.fire(10);
    expect(calls.updates).toHaveLength(0);
    clock.fire(20);
    expect(calls.updates).toHaveLength(1);
    clock.fire(30);
    expect(calls.updates).toHaveLength(1);
    clock.fire(40);
    expect(calls.updates).toHaveLength(2);
  });

  it('caps a long gap', () => {
    const clock = fakeClock();
    const { calls } = counting(clock);
    clock.fire(0);
    clock.fire(10_000);
    expect(calls.updates).toHaveLength(15);
  });

  it('records frame CPU time and reports once a second', () => {
    const clock = fakeClock(4);
    const stats = new FrameStats();
    let seconds = 0;
    startLoop({ update: () => undefined, draw: () => undefined, stats, onSecond: () => seconds++ }, clock);
    for (let t = 0; t <= 2000; t += 100) clock.fire(t);
    expect(stats.count).toBe(21);
    expect(stats.p95()).toBe(4);
    expect(seconds).toBe(2);
  });

  it('stops when disposed', () => {
    const clock = fakeClock();
    const { calls, stop } = counting(clock);
    clock.fire(0);
    stop();
    expect(clock.pending).toBe(0);
    clock.fire(100);
    expect(calls.draws).toEqual([0]);
  });
});
