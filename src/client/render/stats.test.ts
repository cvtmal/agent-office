import { describe, expect, it } from 'vitest';
import { FrameStats } from './stats.js';

describe('FrameStats', () => {
  it('is empty at first', () => {
    const s = new FrameStats();
    expect(s.capacity).toBe(120);
    expect(s.count).toBe(0);
    expect(s.p95()).toBe(0);
  });

  it('reports the nearest-rank 95th percentile', () => {
    const s = new FrameStats();
    for (let i = 1; i <= 100; i++) s.push(i);
    expect(s.count).toBe(100);
    expect(s.p95()).toBe(95);
  });

  it('ignores order', () => {
    const s = new FrameStats();
    for (const ms of [5, 1, 9, 3, 7, 2, 8, 4, 6, 10]) s.push(ms);
    expect(s.p95()).toBe(10);
  });

  it('keeps only the last `capacity` times', () => {
    const s = new FrameStats(20);
    for (let i = 0; i < 20; i++) s.push(100);
    for (let i = 1; i <= 20; i++) s.push(i);
    expect(s.count).toBe(20);
    expect(s.p95()).toBe(19);
  });
});
