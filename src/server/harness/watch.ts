// Watches a repo's harness files and reports a changed reading (DATA-6), read-only.
// `fs.watch` events trigger a debounced check; an unref'd poll covers directories that appear
// later and platforms where `fs.watch` misses events.
import { readdirSync, statSync, watch, type FSWatcher } from 'node:fs';
import { join } from 'node:path';
import { POLL_MS } from '../../shared/constants.js';
import type { HarnessExtras } from '../../shared/types.js';
import { readHarness } from './read.js';

const WATCHED_DIRS = ['.claude/harness', 'docs/harness', 'docs/outcomes', '.git/refs/heads'];
const STAT_FILES = [
  '.claude/harness/lanes.tsv',
  'docs/harness/STATE.md',
  '.git/packed-refs',
  '.git/refs/heads/main',
];

export interface WatchOptions {
  /** Poll interval in ms (default `POLL_MS`). */
  pollMs?: number;
  /** Delay between a file event and the check, in ms (default 100). */
  debounceMs?: number;
  /** Reader (default `readHarness`). */
  read?: (dir: string) => HarnessExtras | null;
}

function statPart(path: string): string {
  try {
    const s = statSync(path);
    return `${s.mtimeMs}:${s.size}`;
  } catch {
    return '-';
  }
}

/** Cheap signature: mtime and size of the files, sorted outcome names. */
function signature(dir: string): string {
  const parts = STAT_FILES.map((f) => statPart(join(dir, f)));
  try {
    parts.push(readdirSync(join(dir, 'docs/outcomes')).sort().join('/'));
  } catch {
    parts.push('-');
  }
  return parts.join('|');
}

/**
 * Calls `onChange` with the new reading whenever the harness of `dir` changes. The first check
 * only records a baseline: callers read the initial value themselves. Never throws.
 */
export function watchHarness(
  dir: string,
  onChange: (harness: HarnessExtras | null) => void,
  { pollMs = POLL_MS, debounceMs = 100, read = readHarness }: WatchOptions = {},
): { close(): void } {
  const watchers = new Map<string, FSWatcher>();
  let closed = false;
  let debounce: NodeJS.Timeout | undefined;
  let lastSig = signature(dir);
  let lastJson = JSON.stringify(read(dir));

  function check(): void {
    if (closed) return;
    attach();
    const sig = signature(dir);
    if (sig === lastSig) return;
    lastSig = sig;
    const harness = read(dir);
    const json = JSON.stringify(harness);
    if (json === lastJson) return;
    lastJson = json;
    onChange(harness);
  }

  function schedule(): void {
    if (closed) return;
    clearTimeout(debounce);
    debounce = setTimeout(check, debounceMs);
    debounce.unref();
  }

  function attach(): void {
    for (const rel of WATCHED_DIRS) {
      if (watchers.has(rel)) continue;
      try {
        const w = watch(join(dir, rel), { persistent: false }, schedule);
        w.on('error', () => {
          w.close();
          watchers.delete(rel);
        });
        watchers.set(rel, w);
      } catch {
        // Not there (yet): the poll tries again.
      }
    }
  }

  attach();
  const poll = setInterval(check, pollMs);
  poll.unref();

  return {
    close(): void {
      if (closed) return;
      closed = true;
      clearInterval(poll);
      clearTimeout(debounce);
      for (const w of watchers.values()) w.close();
      watchers.clear();
    },
  };
}
