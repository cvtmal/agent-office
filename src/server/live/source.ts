// Where the API gets its data (research R5, R6, D-016): a fixed snapshot (`--sample`, tests) or the
// live model wired to the real config dir: tails + watcher, liveness from the registry and an async
// `ps`, harness extras from a watched cache. A replay (`replay/player.ts`) overrides the config dir,
// clock, liveness, roots and harness dirs. Read-only.
import { statSync } from 'node:fs';
import { homedir } from 'node:os';
import { join, sep } from 'node:path';
import { MAX_AGE_HOURS, POLL_MS } from '../../shared/constants.js';
import type { ServerEvent, Snapshot } from '../../shared/types.js';
import { configDir } from '../discovery/config-dir.js';
import { listTranscripts } from '../discovery/files.js';
import { readProcessTableAsync, type ProcessRow } from '../discovery/processes.js';
import { liveRegistry } from '../discovery/registry.js';
import { repoRoot } from '../discovery/repo-root.js';
import { teammateProcs } from '../discovery/teammates.js';
import { thresholdsFromEnv } from '../reader/tokens.js';
import { createHarnessCache, type HarnessCacheOptions } from './harness.js';
import { createLiveModel, type LiveModel, type Liveness } from './model.js';
import { watchTree } from './watch.js';

export interface LiveSource {
  getSnapshot(): Snapshot;
  /** Receives every later batch of events; returns the unsubscribe function. */
  subscribe(listener: (events: ServerEvent[]) => void): () => void;
  close(): Promise<void>;
}

/** A source that always serves `snapshot` and never sends a delta. */
export function staticSource(snapshot: Snapshot): LiveSource {
  return {
    getSnapshot: () => snapshot,
    subscribe: () => () => undefined,
    close: async () => undefined,
  };
}

/** The settings the live source takes from the config file (`config/file.ts`, `filterFor`). */
export interface LiveSourceConfig {
  /** Overrides `CLAUDE_CONFIG_DIR` (`~` expanded). */
  claudeConfigDir?: string;
  maxAgeHours?: number;
  /** Applied to every snapshot (config `projects`/`exclude`). */
  filter?: (snapshot: Snapshot) => Snapshot;
}

export interface LiveSourceOptions {
  env?: Readonly<Record<string, string | undefined>>;
  home?: string;
  config?: LiveSourceConfig;
  /** Poll interval of the watcher (default `POLL_MS`). */
  pollMs?: number;
  /** The process table (default: async `ps`); null when it failed. */
  readTable?: () => Promise<Map<number, ProcessRow> | null>;
  rootOf?: (cwd: string) => string;
  /** Harness reader/watcher overrides (default `harness/`). */
  harness?: Omit<HarnessCacheOptions, 'onChange'>;
  // Replay overrides (R8, D-016 c; `replay/player.ts`):
  /** The config dir to read (replay: the player's copy); wins over `config.claudeConfigDir`. */
  cfgDir?: string;
  /** The model's clock, epoch ms (replay: virtual); drives `generatedAt` (default `Date.now`). */
  now?: () => number;
  /** Registry and teammates (replay: the manifest's live windows); replaces the registry and `ps`. */
  liveness?: Liveness;
  /** The directory holding a root's harness files (replay: the copy); passed to the harness cache. */
  dirOf?: (root: string) => string;
}

/** `ps` runs at most this often unless the registry dir changed (R6). */
const PS_EVERY_MS = 10_000;

/** `mtime:size`, or '-' when the path cannot be stat'ed. */
function sig(path: string): string {
  try {
    const s = statSync(path);
    return `${s.mtimeMs}:${s.size}`;
  } catch {
    return '-';
  }
}

/**
 * The live source on the config dir. Rejects with `ThresholdEnvError` on a bad threshold variable.
 * Resolves once the first snapshot is built.
 */
export async function createLiveSource({
  env = process.env,
  home = homedir(),
  config = {},
  pollMs = POLL_MS,
  readTable = readProcessTableAsync,
  rootOf,
  harness = {},
  cfgDir: cfgDirOverride,
  now = Date.now,
  liveness: livenessOverride,
  dirOf,
}: LiveSourceOptions = {}): Promise<LiveSource> {
  const thresholds = thresholdsFromEnv({ ...env });
  const cfgDir =
    cfgDirOverride ??
    (config.claudeConfigDir !== undefined ? configDir({ CLAUDE_CONFIG_DIR: config.claudeConfigDir }, home) : configDir(env, home));
  const projectsDir = join(cfgDir, 'projects');
  const sessionsDir = join(cfgDir, 'sessions');
  const roots = new Map<string, string>();
  const rootOfCwd =
    rootOf ??
    ((cwd: string): string => {
      let root = roots.get(cwd);
      if (root === undefined) {
        root = repoRoot(cwd);
        roots.set(cwd, root);
      }
      return root;
    });

  // R6: the registry on every refresh; `ps` only when `sessions/` changed or every PS_EVERY_MS.
  let table: Map<number, ProcessRow> | null = null;
  let tableAt = -Infinity;
  let registryDirty = true;
  let sessionsSig = sig(sessionsDir);
  const liveness: Liveness = livenessOverride ?? {
    async registry() {
      const s = sig(sessionsDir);
      if (s !== sessionsSig) {
        sessionsSig = s;
        registryDirty = true;
      }
      if (registryDirty || Date.now() - tableAt >= PS_EVERY_MS) {
        registryDirty = false;
        table = await readTable();
        tableAt = Date.now();
      }
      return liveRegistry(cfgDir, table);
    },
    async teammates() {
      return table ? teammateProcs(table) : [];
    },
  };

  const listeners = new Set<(events: ServerEvent[]) => void>();
  let model: LiveModel | null = null;
  const cache = createHarnessCache({ ...harness, ...(dirOf ? { dirOf } : {}), onChange: () => model?.rebuild() });
  model = createLiveModel({
    cfgDir,
    home,
    now,
    maxAgeHours: config.maxAgeHours ?? MAX_AGE_HOURS,
    thresholds,
    rootOf: rootOfCwd,
    harnessOf: (root) => cache.harnessOf(root),
    ...(config.filter ? { filter: config.filter } : {}),
    liveness,
    onEvents: (events) => {
      for (const listener of listeners) {
        try {
          listener(events);
        } catch {
          // one failing listener must not starve the others
        }
      }
    },
  });
  const live = model;

  /** `mtime:size` of every transcript and side file under `projects/`, listed without reading. */
  function signatures(): Map<string, string> {
    const out = new Map<string, string>();
    const { sessions, agents } = listTranscripts({ cfgDir, cutoffMs: -Infinity, isLive: () => true });
    for (const s of sessions) {
      out.set(s.path, sig(s.path));
      out.set(s.titlePath, sig(s.titlePath));
    }
    for (const a of agents) {
      out.set(a.path, sig(a.path));
      out.set(a.metaPath, sig(a.metaPath));
    }
    return out;
  }

  await live.start();
  let seen = signatures();

  const watcher = watchTree({
    dirs: [projectsDir, sessionsDir],
    pollMs,
    poll: async () => {
      await live.refreshLiveness();
      const now = signatures();
      const changed = new Set<string>();
      for (const [path, s] of now) if (seen.get(path) !== s) changed.add(path);
      for (const path of seen.keys()) if (!now.has(path)) changed.add(path);
      seen = now;
      return changed;
    },
    onBatch: (paths) => {
      const files = new Set<string>();
      for (const path of paths) {
        if (path === sessionsDir || path.startsWith(sessionsDir + sep)) registryDirty = true;
        else files.add(path);
      }
      if (files.size > 0) void live.ingest(files).catch(() => undefined);
    },
  });

  return {
    getSnapshot: () => live.snapshot(),
    subscribe(listener) {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
    async close() {
      watcher.close();
      cache.close();
      listeners.clear();
      await live.close();
    },
  };
}
