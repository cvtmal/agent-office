// The live model (live-api research Selected Approach, R2, R4, R6, R7): per transcript a tail and its
// retained records; every change rebuilds the snapshot with #1's `buildModel` over the retained records,
// diffs it against the previous one and hands the events on. Read-only: transcripts are only read.
import { stat } from 'node:fs/promises';
import { join, sep } from 'node:path';
import type { HarnessExtras, ServerEvent, Snapshot } from '../../shared/types.js';
import { SNAPSHOT_VERSION } from '../../shared/constants.js';
import type { Thresholds } from '../../shared/verdict.js';
import { listTranscripts, readCustomTitle, readMeta } from '../discovery/files.js';
import type { AgentMeta, Discovered, RegistryEntry, TeammateProc } from '../discovery/types.js';
import { buildModel, teamPair } from '../reader/model.js';
import type { FileKind } from '../reader/records.js';
import { emptyRetained, retain, type Retained } from '../reader/retain.js';
import { diffSnapshots } from './diff.js';
import { createTail, type Tail } from './tail.js';

export interface Liveness {
  /** Live registry entries; called before `teammates()` on every refresh. */
  registry(): Promise<Map<string, RegistryEntry>>;
  teammates(): Promise<TeammateProc[]>;
}

export interface LiveModelOptions {
  cfgDir: string;
  home: string;
  /** Epoch ms; the model's clock (replay passes a virtual one). */
  now: () => number;
  maxAgeHours: number;
  thresholds: Thresholds;
  rootOf: (cwd: string) => string;
  harnessOf: (root: string) => HarnessExtras | null;
  /** Applied to every built snapshot before diffing (config `projects`/`exclude`). */
  filter?: (snapshot: Snapshot) => Snapshot;
  /** Detail mode: tool inputs are retained whole and activities carry `detail`. Default: off. */
  detailMode?: boolean;
  liveness: Liveness;
  /** Receives each non-empty list of events, in order. */
  onEvents: (events: ServerEvent[]) => void;
}

export interface LiveModel {
  /** Lists and reads every admitted transcript, reads liveness once and builds the first snapshot. */
  start(): Promise<void>;
  /** Processes changed paths (transcripts, `custom-title.json`, `meta.json`, new files), then rebuilds. */
  ingest(paths: Set<string>): Promise<void>;
  /** Re-reads liveness, drops ended files older than `maxAgeHours`, then rebuilds. */
  refreshLiveness(): Promise<void>;
  /** Builds the snapshot from the current state and emits the diff. */
  rebuild(): void;
  snapshot(): Snapshot;
  /** Stops emitting; resolves once the operation in progress has finished. */
  close(): Promise<void>;
}

interface FileState {
  kind: FileKind;
  sessionId: string;
  agentId: string | null;
  tail: Tail;
  retained: Retained;
  mtimeMs: number;
  /** `custom-title.json` (sessions) or `agent-<id>.meta.json` (agents). */
  sidePath: string;
  customTitle: string | null;
  meta: AgentMeta | null;
}

interface Listed {
  kind: FileKind;
  sessionId: string;
  agentId: string | null;
  path: string;
  mtimeMs: number;
  sidePath: string;
}

const empty = (now: number): Snapshot => ({
  version: SNAPSHOT_VERSION,
  generatedAt: new Date(now).toISOString(),
  projects: [],
  characters: [],
  activities: [],
});

export function createLiveModel(opts: LiveModelOptions): LiveModel {
  const projectsDir = join(opts.cfgDir, 'projects');
  const detail = opts.detailMode === true;
  const files = new Map<string, FileState>();
  /** side file path → transcript path */
  const sides = new Map<string, string>();
  let registry = new Map<string, RegistryEntry>();
  let teammates: TeammateProc[] = [];
  let previous: Snapshot | null = null;
  let current = empty(opts.now());
  let closed = false;
  let queue: Promise<unknown> = Promise.resolve();

  /** Runs `job` after every earlier one (ingest and refresh never interleave). */
  function serial(job: () => Promise<void>): Promise<void> {
    const next = queue.then(job, job);
    queue = next.catch(() => undefined);
    return next;
  }

  const cutoff = (): number => opts.now() - opts.maxAgeHours * 3600 * 1000;

  const matchesTeammate = (state: FileState): boolean => {
    const pair = teamPair(state.retained.records);
    return pair !== null && teammates.some((t) => t.agentName === pair.agentName && t.teamName === pair.teamName);
  };

  function list(): Listed[] {
    // Every session is listed; admission decides (R7 needs the stale ones too).
    const { sessions, agents } = listTranscripts({ cfgDir: opts.cfgDir, cutoffMs: cutoff(), isLive: () => true });
    return [
      ...sessions.map((s) => ({ kind: 'session' as const, sessionId: s.sessionId, agentId: null, path: s.path, mtimeMs: s.mtimeMs, sidePath: s.titlePath })),
      ...agents.map((a) => ({ kind: 'agent' as const, sessionId: a.sessionId, agentId: a.agentId, path: a.path, mtimeMs: a.mtimeMs, sidePath: a.metaPath })),
    ];
  }

  async function readInto(state: FileState): Promise<void> {
    // Retained piece by piece, so a whole file's parsed records never sit in memory at once (#7, RUN-3).
    await state.tail.read((chunk, reset) => {
      state.retained = retain(reset ? emptyRetained() : state.retained, chunk, state.kind, { keepInput: detail });
    });
  }

  function readSide(state: FileState): void {
    if (state.kind === 'session') state.customTitle = readCustomTitle(state.sidePath);
    else state.meta = readMeta(state.sidePath);
  }

  /** Admits a listed file as `readTranscripts` would (fresh or live), or as a quiet teammate (R7). */
  async function admit(item: Listed): Promise<void> {
    const state: FileState = {
      kind: item.kind,
      sessionId: item.sessionId,
      agentId: item.agentId,
      tail: createTail(item.path),
      retained: emptyRetained(),
      mtimeMs: item.mtimeMs,
      sidePath: item.sidePath,
      customTitle: null,
      meta: null,
    };
    const fresh = item.mtimeMs >= cutoff() || (item.kind === 'session' && registry.has(item.sessionId));
    if (!fresh && (item.kind === 'agent' || teammates.length === 0)) return;
    await readInto(state);
    if (!fresh && !matchesTeammate(state)) return;
    readSide(state);
    files.set(item.path, state);
    sides.set(state.sidePath, item.path);
  }

  function drop(path: string): void {
    const state = files.get(path);
    if (!state) return;
    files.delete(path);
    sides.delete(state.sidePath);
  }

  async function admitNew(): Promise<void> {
    for (const item of list()) {
      if (!files.has(item.path)) await admit(item);
    }
  }

  async function readLiveness(): Promise<void> {
    registry = await opts.liveness.registry();
    teammates = await opts.liveness.teammates();
  }

  function rebuild(): void {
    if (closed) return;
    const input: Discovered = { sessions: [], agents: [], registry, teammates };
    for (const [path, s] of files) {
      if (s.kind === 'session') {
        input.sessions.push({ sessionId: s.sessionId, path, mtimeMs: s.mtimeMs, text: '', parsed: s.retained, customTitle: s.customTitle });
      } else {
        input.agents.push({ sessionId: s.sessionId, agentId: s.agentId ?? '', path, mtimeMs: s.mtimeMs, text: '', parsed: s.retained, meta: s.meta });
      }
    }
    const built = buildModel(input, {
      now: new Date(opts.now()),
      home: opts.home,
      thresholds: opts.thresholds,
      rootOf: opts.rootOf,
      harnessOf: opts.harnessOf,
      detail,
    });
    const next = opts.filter ? opts.filter(built.snapshot) : built.snapshot;
    const events = diffSnapshots(previous, next);
    previous = next;
    current = next;
    if (events.length > 0) opts.onEvents(events);
  }

  return {
    start: () =>
      serial(async () => {
        await readLiveness();
        for (const item of list()) await admit(item);
        rebuild();
      }),

    ingest: (paths) =>
      serial(async () => {
        if (closed) return;
        let listNeeded = false;
        for (const path of paths) {
          const state = files.get(path);
          if (state) {
            try {
              state.mtimeMs = (await stat(path)).mtimeMs;
            } catch {
              drop(path); // deleted → the rebuild sends a removal snapshot (R3)
              continue;
            }
            await readInto(state);
            continue;
          }
          const owner = sides.get(path);
          if (owner !== undefined) {
            const s = files.get(owner);
            if (s) readSide(s);
            continue;
          }
          if (path.startsWith(projectsDir + sep) && path.endsWith('.jsonl')) listNeeded = true;
        }
        if (listNeeded) await admitNew();
        rebuild();
      }),

    refreshLiveness: () =>
      serial(async () => {
        if (closed) return;
        await readLiveness();
        // R7: a file leaves once its session is not live (registry or quiet teammate) and it is stale.
        const liveSessions = new Set(registry.keys());
        for (const s of files.values()) if (s.kind === 'session' && matchesTeammate(s)) liveSessions.add(s.sessionId);
        const limit = cutoff();
        for (const [path, s] of [...files]) {
          if (!liveSessions.has(s.sessionId) && s.mtimeMs < limit) drop(path);
        }
        rebuild();
      }),

    rebuild,
    snapshot: () => current,

    close(): Promise<void> {
      closed = true;
      return queue.then(() => undefined);
    },
  };
}
