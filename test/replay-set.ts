// A replay set read in one go through `discover` and the reader: the reference the player's final
// state is compared with (`test/fixtures.test.ts`, `src/server/replay/replay.int.test.ts`).
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { REPLAY_SETS, type Manifest } from '../fixtures/gen/replay.js';
import { discover } from '../src/server/discovery/index.js';
import type { RegistryEntry } from '../src/server/discovery/types.js';
import { buildModel } from '../src/server/reader/model.js';
import { THRESHOLDS } from '../src/shared/constants.js';

export const REPLAY_DIR = fileURLToPath(new URL('../fixtures/replay/', import.meta.url));

export interface ReadSetOptions {
  /**
   * `all` (default): every `manifest.live` session is registered live. `end`: only the windows
   * active at the end of the set (`fromMs ≤ durationMs ≤ toMs`), as the player registers them.
   */
  live?: 'all' | 'end';
}

/** The set at its end (`base + durationMs`) through `discover` and `buildModel`. */
export function readSet(name: (typeof REPLAY_SETS)[number], { live = 'all' }: ReadSetOptions = {}) {
  const dir = join(REPLAY_DIR, name);
  const manifest = JSON.parse(readFileSync(join(dir, 'manifest.json'), 'utf8')) as Manifest;
  const now = new Date(Date.parse(manifest.base) + manifest.durationMs);
  const found = discover({ cfgDir: join(dir, 'config'), now, maxAgeHours: Infinity, table: null });
  const active = (w: Manifest['live'][number]): boolean =>
    live === 'all' || (w.fromMs <= manifest.durationMs && manifest.durationMs <= w.toMs);
  const registry = new Map<string, RegistryEntry>(
    manifest.live.flatMap((w, i): [string, RegistryEntry][] =>
      active(w)
        ? [[w.sessionId, { pid: 5000 + i, sessionId: w.sessionId, procStart: null, status: w.status ?? null, updatedAt: 0, cwd: null, name: null }]]
        : [],
    ),
  );
  const rootOf = (cwd: string) => cwd.replace(/\/\.claude\/worktrees\/.*$/, '');
  return {
    manifest,
    ...buildModel({ ...found, registry }, { now, home: manifest.home, thresholds: THRESHOLDS, rootOf }),
  };
}
