// The canvas loop (plan P-9): fixed 60 Hz update steps, one draw per animation frame,
// the CPU time of each frame (update + draw) into `FrameStats`, and a callback once a
// second (to publish `data-frame-ms`). The clock is injectable for tests.
import { FrameStats } from './stats.js';

/** Updates per second. */
export const UPDATE_HZ = 60;

/** Longest gap (ms) one frame catches up on, e.g. after the tab was hidden. */
export const MAX_FRAME_GAP_MS = 250;

/** Time source and frame scheduler (the browser's by default). */
export interface LoopClock {
  /** CPU-time clock in ms (`performance.now`). */
  now(): number;
  requestFrame(cb: (timeMs: number) => void): number;
  cancelFrame(handle: number): void;
}

export interface LoopOptions {
  /** One fixed step of `dtMs` (1000 / 60). */
  update(dtMs: number): void;
  /** One draw per animation frame, with the frame's timestamp. */
  draw(timeMs: number): void;
  stats?: FrameStats;
  /** Called about once a second with the stats. */
  onSecond?(stats: FrameStats): void;
}

function browserClock(): LoopClock {
  return {
    now: () => performance.now(),
    requestFrame: (cb) => requestAnimationFrame(cb),
    cancelFrame: (h) => {
      cancelAnimationFrame(h);
    },
  };
}

/** Starts the loop; returns a disposer that stops it. */
export function startLoop(opts: LoopOptions, clock: LoopClock = browserClock()): () => void {
  const stats = opts.stats ?? new FrameStats();
  const stepMs = 1000 / UPDATE_HZ;
  // The accumulator counts ms x UPDATE_HZ, so whole-ms gaps add up without float drift
  // (50 ms = exactly 3 steps).
  let acc = 0;
  let last: number | undefined;
  let lastSecond: number | undefined;
  let stopped = false;
  let handle = 0;

  const frame = (t: number): void => {
    if (stopped) return;
    const gap = last === undefined ? 0 : Math.min(MAX_FRAME_GAP_MS, Math.max(0, t - last));
    last = t;
    lastSecond ??= t;
    const start = clock.now();
    acc += gap * UPDATE_HZ;
    while (acc >= 1000) {
      opts.update(stepMs);
      acc -= 1000;
    }
    opts.draw(t);
    stats.push(clock.now() - start);
    if (t - lastSecond >= 1000) {
      lastSecond = t;
      opts.onSecond?.(stats);
    }
    handle = clock.requestFrame(frame);
  };

  handle = clock.requestFrame(frame);
  return () => {
    stopped = true;
    clock.cancelFrame(handle);
  };
}
