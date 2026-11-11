// Watches transcript trees and reports changed paths in batches (DATA-5, research R4, R5, Q-F).
// `fs.watch` recursive is only a fast path: it is "not 100% consistent across platforms" and
// the filename "is not always guaranteed", so an unref'd poll every `pollMs` is the guarantee.
// Read-only: nothing here opens a file.
import { watch, type FSWatcher } from 'node:fs';
import { join } from 'node:path';
import { POLL_MS } from '../../shared/constants.js';

export interface WatchTreeOptions {
  /** Directories to watch recursively; a missing one is skipped (the poll covers it). */
  dirs: string[];
  /** Poll interval in ms (default `POLL_MS`). */
  pollMs?: number;
  /** Paths are coalesced and delivered at most every `batchMs` (default 100). */
  batchMs?: number;
  /** Returns the paths changed since its last call. */
  poll: () => Promise<Set<string>>;
  /** Receives each non-empty batch of changed paths. */
  onBatch: (paths: Set<string>) => void;
}

export function watchTree({
  dirs,
  pollMs = POLL_MS,
  batchMs = 100,
  poll,
  onBatch,
}: WatchTreeOptions): { close(): void } {
  const watchers = new Set<FSWatcher>();
  let pending = new Set<string>();
  let closed = false;
  let warned = false;
  let polling = false;
  let lastFlush = 0;
  let timer: NodeJS.Timeout | undefined;

  /** Logs the first watcher failure only, and never a path (they are real paths). */
  function warnOnce(error: unknown): void {
    if (warned) return;
    warned = true;
    const code = (error as NodeJS.ErrnoException | null)?.code ?? 'error';
    console.warn(`live: fs.watch unavailable (${code}); polling every ${pollMs} ms`);
  }

  function flush(): void {
    timer = undefined;
    if (closed || pending.size === 0) return;
    const batch = pending;
    pending = new Set();
    lastFlush = Date.now();
    onBatch(batch);
  }

  /** Schedules a flush `delay` ms from now unless one is already scheduled. */
  function schedule(delay: number): void {
    if (closed || timer !== undefined) return;
    timer = setTimeout(flush, Math.max(0, delay));
    timer.unref();
  }

  function runPoll(): void {
    if (closed || polling) return;
    polling = true;
    poll()
      .then((paths) => {
        if (closed) return;
        for (const p of paths) pending.add(p);
        // Poll results are already coalesced: deliver as soon as the batch spacing allows.
        if (pending.size > 0) schedule(lastFlush + batchMs - Date.now());
      })
      .catch(() => undefined)
      .finally(() => {
        polling = false;
      });
  }

  for (const dir of dirs) {
    let w: FSWatcher;
    try {
      w = watch(dir, { recursive: true, persistent: false }, (_event, filename) => {
        if (closed) return;
        if (filename === null) {
          runPoll();
          return;
        }
        pending.add(join(dir, filename.toString()));
        // Trailing edge: the several events of one write land in one batch.
        schedule(batchMs);
      });
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== 'ENOENT') warnOnce(error);
      continue;
    }
    w.on('error', (error) => {
      w.close();
      watchers.delete(w);
      warnOnce(error);
    });
    watchers.add(w);
  }

  const interval = setInterval(runPoll, pollMs);
  interval.unref();

  return {
    close(): void {
      if (closed) return;
      closed = true;
      clearInterval(interval);
      clearTimeout(timer);
      for (const w of watchers) w.close();
      watchers.clear();
      pending.clear();
    },
  };
}
