// Frame-time statistics (plan P-9): a ring buffer of the last N frame CPU times
// and their 95th percentile, published as `#office[data-frame-ms]`. DOM-free.

/** Keeps the last `capacity` frame times (ms) and reports their p95. */
export class FrameStats {
  /** Maximum number of frame times held. */
  readonly capacity: number;
  private readonly times: number[] = [];
  private next = 0;

  constructor(capacity = 120) {
    this.capacity = capacity;
  }

  /** Records one frame time in ms, replacing the oldest once full. */
  push(ms: number): void {
    if (this.times.length < this.capacity) this.times.push(ms);
    else this.times[this.next] = ms;
    this.next = (this.next + 1) % this.capacity;
  }

  /** Number of frame times held (at most `capacity`). */
  get count(): number {
    return this.times.length;
  }

  /** 95th percentile (nearest rank) of the held times; 0 when empty. */
  p95(): number {
    if (this.times.length === 0) return 0;
    const sorted = [...this.times].sort((a, b) => a - b);
    return sorted[Math.ceil(0.95 * sorted.length) - 1] ?? 0;
  }
}
