// Timing-robust on slow CI (the pattern of `harness/watch.test.ts`): positive checks wait on an
// event; the negative check is proven against a second, open watcher that must see the change.
import { appendFileSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { watchTree } from './watch.js';

const WAIT = { timeout: 10_000, interval: 10 };
const TEST_TIMEOUT = 30_000;
const NO_POLL = 60_000;

let base: string;
let n = 0;

function fresh(): { dir: string; file: string } {
  const dir = join(base, `w${n++}`);
  mkdirSync(join(dir, 'project'), { recursive: true });
  const file = join(dir, 'project', 'a.jsonl');
  writeFileSync(file, '{}\n');
  return { dir, file };
}

const settle = (ms: number): Promise<void> => new Promise((r) => setTimeout(r, ms));

/** Batches that contain `path`. */
function hits(onBatch: ReturnType<typeof vi.fn<(paths: Set<string>) => void>>, path: string): number {
  return onBatch.mock.calls.filter(([paths]) => paths.has(path)).length;
}

beforeAll(() => {
  base = mkdtempSync(join(tmpdir(), 'ao-live-watch-'));
});

afterAll(() => {
  rmSync(base, { recursive: true, force: true });
});

describe('watchTree', () => {
  it(
    'delivers an append once, within 500 ms, through fs.watch',
    async () => {
      const { dir, file } = fresh();
      const poll = vi.fn(() => Promise.resolve(new Set<string>()));
      const onBatch = vi.fn<(paths: Set<string>) => void>();
      const w = watchTree({ dirs: [dir], pollMs: NO_POLL, poll, onBatch });
      try {
        await settle(150); // let a late creation event from the platform drain first
        onBatch.mockClear();
        const t0 = Date.now();
        appendFileSync(file, '{"type":"user"}\n');
        await vi.waitFor(() => expect(hits(onBatch, file)).toBeGreaterThan(0), WAIT);
        expect(Date.now() - t0).toBeLessThan(500);
        await settle(300);
        expect(hits(onBatch, file)).toBe(1);
        expect(poll).not.toHaveBeenCalled();
      } finally {
        w.close();
      }
    },
    TEST_TIMEOUT,
  );

  it(
    'falls back to the poll with watch disabled, within pollMs + 100 ms',
    async () => {
      const pollMs = 200;
      let changed = false;
      const poll = vi.fn(() => Promise.resolve(new Set<string>(changed ? ['x.jsonl'] : [])));
      const onBatch = vi.fn<(paths: Set<string>) => void>();
      const w = watchTree({ dirs: [], pollMs, poll, onBatch });
      try {
        changed = true;
        const t0 = Date.now();
        await vi.waitFor(() => expect(onBatch).toHaveBeenCalled(), WAIT);
        expect(Date.now() - t0).toBeLessThan(pollMs + 100);
        expect(onBatch.mock.calls[0]?.[0]).toEqual(new Set(['x.jsonl']));
      } finally {
        w.close();
      }
    },
    TEST_TIMEOUT,
  );

  it(
    'stops both the watch and the poll after close()',
    async () => {
      const { dir, file } = fresh();
      const pollMs = 100;
      const closedPoll = vi.fn(() => Promise.resolve(new Set<string>(['p.jsonl'])));
      const closedBatch = vi.fn<(paths: Set<string>) => void>();
      const openBatch = vi.fn<(paths: Set<string>) => void>();
      const closedOne = watchTree({ dirs: [dir], pollMs, poll: closedPoll, onBatch: closedBatch });
      const openOne = watchTree({
        dirs: [dir],
        pollMs: NO_POLL,
        poll: () => Promise.resolve(new Set()),
        onBatch: openBatch,
      });
      try {
        closedOne.close();
        closedOne.close(); // idempotent
        appendFileSync(file, '{"type":"user"}\n');
        await vi.waitFor(() => expect(hits(openBatch, file)).toBeGreaterThan(0), WAIT);
        await settle(pollMs * 3);
        expect(closedPoll).not.toHaveBeenCalled();
        expect(closedBatch).not.toHaveBeenCalled();
      } finally {
        openOne.close();
      }
    },
    TEST_TIMEOUT,
  );

  it('skips a missing directory without throwing', () => {
    const w = watchTree({
      dirs: [join(base, 'missing')],
      poll: () => Promise.resolve(new Set()),
      onBatch: vi.fn(),
    });
    expect(() => w.close()).not.toThrow();
  });
});
