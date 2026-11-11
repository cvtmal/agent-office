// Cached harness extras per project root for the live model (D-016, research R15). The first lookup of
// a root reads it and starts a watcher; later lookups return the stored value. A watcher's change
// replaces the value and reports the root, so the caller can rebuild (→ a `project` delta).
// Read-only: `read` and `watch` default to `harness/` (#4).
import type { HarnessExtras } from '../../shared/types.js';
import { readHarness } from '../harness/read.js';
import { watchHarness } from '../harness/watch.js';

export type HarnessRead = (dir: string) => HarnessExtras | null;
export type HarnessWatch = (dir: string, onChange: (harness: HarnessExtras | null) => void) => { close(): void };

export interface HarnessCacheOptions {
  /** The directory holding a root's harness files (replay maps roots to its copy). Default: the root. */
  dirOf?: (root: string) => string;
  read?: HarnessRead;
  /** Default: `watchHarness` with the same `read`. */
  watch?: HarnessWatch;
  /** Called with the root after a watcher stored a changed value. */
  onChange: (root: string) => void;
}

export interface HarnessCache {
  harnessOf(root: string): HarnessExtras | null;
  close(): void;
}

export function createHarnessCache({
  dirOf = (root) => root,
  read = (dir) => readHarness(dir),
  watch = (dir, onChange) => watchHarness(dir, onChange, { read }),
  onChange,
}: HarnessCacheOptions): HarnessCache {
  const values = new Map<string, HarnessExtras | null>();
  const watchers = new Map<string, { close(): void }>();
  let closed = false;

  return {
    harnessOf(root: string): HarnessExtras | null {
      if (values.has(root)) return values.get(root) ?? null;
      const dir = dirOf(root);
      const value = read(dir);
      if (closed) return value;
      values.set(root, value);
      // Also when `value` is null: a repo that gains harness files later is picked up (P-6).
      watchers.set(
        root,
        watch(dir, (harness) => {
          if (closed) return;
          values.set(root, harness);
          onChange(root);
        }),
      );
      return value;
    },
    close(): void {
      if (closed) return;
      closed = true;
      for (const w of watchers.values()) w.close();
      watchers.clear();
    },
  };
}
