// Timing-robust on slow CI: every positive check waits on an event with a generous timeout;
// the negative checks are proven against a second, open watcher that must see the same change.
import { mkdirSync, mkdtempSync, readFileSync, rmSync, utimesSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import type { HarnessExtras } from '../../shared/types.js';
import { readHarness } from './read.js';
import { watchHarness } from './watch.js';

const WAIT = { timeout: 10_000, interval: 25 };
const TEST_TIMEOUT = 30_000;
const OPTS = { pollMs: 200, debounceMs: 20 };

let base: string;
let n = 0;

function fresh(): string {
  const dir = join(base, `w${n++}`);
  mkdirSync(dir);
  return dir;
}

function put(dir: string, rel: string, content = ''): void {
  mkdirSync(dirname(join(dir, rel)), { recursive: true });
  writeFileSync(join(dir, rel), content);
}

/** The reader without git, and a spy on it. */
function reader(): ReturnType<typeof vi.fn<(d: string) => HarnessExtras | null>> {
  return vi.fn((d: string) => readHarness(d, { git: () => null }));
}

beforeAll(() => {
  base = mkdtempSync(join(tmpdir(), 'ao-watch-'));
});

afterAll(() => {
  rmSync(base, { recursive: true, force: true });
});

describe('watchHarness', () => {
  it(
    'reports a new outcome file once',
    async () => {
      const d = fresh();
      put(d, 'docs/outcomes/00-a.md');
      const onChange = vi.fn();
      const w = watchHarness(d, onChange, { ...OPTS, read: reader() });
      try {
        expect(onChange).not.toHaveBeenCalled();
        put(d, 'docs/outcomes/02-x.md');
        await vi.waitFor(() => expect(onChange).toHaveBeenCalled(), WAIT);
        expect(onChange).toHaveBeenCalledTimes(1);
        expect(onChange.mock.calls[0]?.[0]?.outcomes).toEqual([
          { nn: 0, slug: 'a' },
          { nn: 2, slug: 'x' },
        ]);
      } finally {
        w.close();
      }
    },
    TEST_TIMEOUT,
  );

  it(
    'picks up harness directories that appear later',
    async () => {
      const d = fresh();
      const onChange = vi.fn();
      const w = watchHarness(d, onChange, { ...OPTS, read: reader() });
      try {
        put(d, 'docs/outcomes/01-y.md');
        await vi.waitFor(() => expect(onChange).toHaveBeenCalled(), WAIT);
        expect(onChange.mock.calls[0]?.[0]).not.toBeNull();
      } finally {
        w.close();
      }
    },
    TEST_TIMEOUT,
  );

  it(
    're-reads a touched file but stays quiet when its content is unchanged',
    async () => {
      const d = fresh();
      put(d, 'docs/harness/STATE.md', '## Now\n- Wave: W1\n');
      const read = reader();
      const onChange = vi.fn();
      const w = watchHarness(d, onChange, { ...OPTS, read });
      try {
        const before = read.mock.calls.length;
        const path = join(d, 'docs/harness/STATE.md');
        writeFileSync(path, readFileSync(path));
        const later = new Date(Date.now() + 5_000);
        utimesSync(path, later, later);
        // The signature changed, so the watcher re-reads; that re-read is the event we wait on.
        await vi.waitFor(() => expect(read.mock.calls.length).toBeGreaterThan(before), WAIT);
        expect(onChange).not.toHaveBeenCalled();
      } finally {
        w.close();
      }
    },
    TEST_TIMEOUT,
  );

  it(
    'stops after close()',
    async () => {
      const d = fresh();
      put(d, 'docs/outcomes/00-a.md');
      const closedSpy = vi.fn();
      const openSpy = vi.fn();
      const closedOne = watchHarness(d, closedSpy, { ...OPTS, read: reader() });
      const openOne = watchHarness(d, openSpy, { ...OPTS, read: reader() });
      try {
        closedOne.close();
        closedOne.close(); // idempotent
        put(d, 'docs/outcomes/01-b.md');
        await vi.waitFor(() => expect(openSpy).toHaveBeenCalled(), WAIT);
        // Two more poll periods for a stray timer of the closed watcher to fire, if it could.
        await new Promise((r) => setTimeout(r, OPTS.pollMs * 2));
        expect(closedSpy).not.toHaveBeenCalled();
      } finally {
        openOne.close();
      }
    },
    TEST_TIMEOUT,
  );

  it('does not throw on a missing directory', () => {
    const w = watchHarness(join(base, 'missing'), vi.fn(), { ...OPTS, read: reader() });
    expect(() => w.close()).not.toThrow();
  });
});
