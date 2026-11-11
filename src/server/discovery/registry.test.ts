import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { parseLstart, type ProcessRow } from './processes.js';
import { liveRegistry, pidAlive } from './registry.js';

const START = 'Wed Nov 11 08:30:05 2026';
const STARTED = parseLstart(START);
const SID_A = '00000000-0000-4000-8000-00000000000a';
const SID_B = '00000000-0000-4000-8000-00000000000b';

function table(...rows: [number, number | null][]): Map<number, ProcessRow> {
  return new Map(rows.map(([pid, startedAt]) => [pid, { pid, startedAt, command: 'claude' }]));
}

let cfg: string;

function entry(file: string, content: unknown): void {
  writeFileSync(join(cfg, 'sessions', file), typeof content === 'string' ? content : JSON.stringify(content));
}

beforeEach(() => {
  cfg = mkdtempSync(join(tmpdir(), 'ao-registry-'));
  mkdirSync(join(cfg, 'sessions'));
});

afterEach(() => {
  rmSync(cfg, { recursive: true, force: true });
});

describe('pidAlive', () => {
  it('is alive when the pid runs and started at procStart', () => {
    expect(pidAlive(100, START, table([100, STARTED]))).toBe(true);
  });

  it('is dead when the pid is not in the table', () => {
    expect(pidAlive(100, START, table([101, STARTED]))).toBe(false);
  });

  it('is dead when the start time is more than 2 s off (pid reuse)', () => {
    expect(pidAlive(100, START, table([100, (STARTED ?? 0) + 3]))).toBe(false);
    expect(pidAlive(100, START, table([100, (STARTED ?? 0) - 2]))).toBe(true);
  });

  it('is alive when either start time is unknown', () => {
    expect(pidAlive(100, 'not a date', table([100, STARTED]))).toBe(true);
    expect(pidAlive(100, null, table([100, STARTED]))).toBe(true);
    expect(pidAlive(100, START, table([100, null]))).toBe(true);
  });

  it('falls back to the kill probe without a table', () => {
    expect(pidAlive(100, START, null, (pid) => pid === 100)).toBe(true);
    expect(pidAlive(100, START, null, () => false)).toBe(false);
  });
});

describe('liveRegistry', () => {
  it('keeps live entries with their fields', () => {
    entry('100.json', { pid: 100, sessionId: SID_A, procStart: START, status: 'busy', updatedAt: 5, cwd: '/home/dev/app', name: 'cto' });
    expect(liveRegistry(cfg, table([100, STARTED]))).toEqual(
      new Map([
        [SID_A, { pid: 100, sessionId: SID_A, procStart: START, status: 'busy', updatedAt: 5, cwd: '/home/dev/app', name: 'cto' }],
      ]),
    );
  });

  it('drops dead pids and entries without an integer pid or a string sessionId', () => {
    entry('1.json', { pid: 200, sessionId: SID_A });
    entry('2.json', { pid: true, sessionId: SID_A });
    entry('3.json', { pid: 1.5, sessionId: SID_A });
    entry('4.json', { pid: 100, sessionId: 7 });
    entry('5.json', [100, SID_A]);
    expect(liveRegistry(cfg, table([100, STARTED])).size).toBe(0);
  });

  it('keeps the newest updatedAt per session', () => {
    entry('a.json', { pid: 100, sessionId: SID_A, updatedAt: 9 });
    entry('b.json', { pid: 101, sessionId: SID_A, updatedAt: 3 });
    entry('c.json', { pid: 102, sessionId: SID_B, updatedAt: 'x' });
    const live = liveRegistry(cfg, table([100, null], [101, null], [102, null]));
    expect(live.get(SID_A)?.pid).toBe(100);
    expect(live.get(SID_B)).toMatchObject({ pid: 102, updatedAt: 0, procStart: null, status: null, cwd: null, name: null });
  });

  it('ignores non-json files and unreadable JSON', () => {
    entry('100.key', { pid: 100, sessionId: SID_A });
    entry('bad.json', '{not json');
    expect(liveRegistry(cfg, table([100, null])).size).toBe(0);
  });

  it('is empty when there is no sessions dir', () => {
    expect(liveRegistry(join(cfg, 'missing'), table()).size).toBe(0);
  });
});
