// Plays a replay set (DATA-9, research R8, R15 c) into a working copy under `var/replay/<name>-<pid>/`
// on a virtual clock: transcript lines are appended when their record `timestamp` is due, an agent's
// `meta.json` lands with its last line, and `files[]` appear at `appearsAtMs` (at `as` when given,
// D-020). The live source reads the copy as if it were a config dir. The set itself is only read;
// every write goes through `var.ts`.
import { readdirSync, readFileSync } from 'node:fs';
import { join, relative, sep } from 'node:path';
import { repoRoot } from '../discovery/repo-root.js';
import type { RegistryEntry } from '../discovery/types.js';
import type { Liveness } from '../live/model.js';
import { REPO_ROOT } from '../paths.js';
import { appendVarFile, copyIntoVar, removeVarDir, varDir } from '../var.js';
import { readManifest, type Manifest } from './manifest.js';

/** How often due lines and files are played, in real ms. */
const TICK_MS = 50;

export interface ReplayOptions {
  /** The set directory (holds `manifest.json`, `config/`, optional repo dirs). */
  dir: string;
  /** Virtual ms per real ms (default 1). */
  speed?: number;
  /** Repo root whose `var/` receives the copy (default: this repo). */
  root?: string;
  /** Real clock, epoch ms (tests inject one). */
  clock?: () => number;
  /** Receives `replay finished` (default `console.log`). */
  log?: (message: string) => void;
}

export interface Replay {
  manifest: Manifest;
  /** The copy's `config/`: the live source's config dir. */
  cfgDir: string;
  /** Virtual epoch ms: `base + min(elapsed × speed, durationMs)`. */
  now(): number;
  /** The `live` windows active at `now()`; never `ps`, no teammates. */
  liveness: Liveness;
  /** The longest `repos[].root` that is `cwd` or a parent of it; else `repoRoot(cwd)`. */
  rootOf(cwd: string): string;
  /** The copy of `repos[].dir` for a repo root; else `root` itself. */
  dirOf(root: string): string;
  /** Resolves once the whole set has been played (or the replay was closed). */
  done: Promise<void>;
  close(): void;
}

interface Track {
  /** Copy-relative path of the transcript. */
  rel: string;
  lines: string[];
  /** Epoch ms each line is due; an untimestamped line goes with the line before. */
  due: number[];
  next: number;
  /** Agent `meta.json` (set-relative), copied once the last line is played. */
  meta: string | null;
}

/** Set-relative paths of every file under `dir`, `/`-separated, sorted. */
function filesUnder(dir: string): string[] {
  return readdirSync(dir, { recursive: true, withFileTypes: true })
    .filter((d) => d.isFile())
    .map((d) => relative(dir, join(d.parentPath, d.name)).split(sep).join('/'))
    .sort();
}

/** The text split into lines that keep their `\n`. */
function splitLines(text: string): string[] {
  const out: string[] = [];
  let start = 0;
  for (let i = text.indexOf('\n'); i >= 0; i = text.indexOf('\n', start)) {
    out.push(text.slice(start, i + 1));
    start = i + 1;
  }
  if (start < text.length) out.push(text.slice(start));
  return out;
}

/** The record's `timestamp` as epoch ms, or null (garbled line, no timestamp). */
function timestampOf(line: string): number | null {
  try {
    const rec: unknown = JSON.parse(line);
    if (typeof rec !== 'object' || rec === null) return null;
    const ts = (rec as { timestamp?: unknown }).timestamp;
    const ms = typeof ts === 'string' ? Date.parse(ts) : NaN;
    return Number.isNaN(ms) ? null : ms;
  } catch {
    return null;
  }
}

export function startReplay({ dir, speed = 1, root = REPO_ROOT, clock = Date.now, log = console.log }: ReplayOptions): Replay {
  if (!(Number.isFinite(speed) && speed > 0)) throw new Error(`replay speed must be a number greater than 0, got ${String(speed)}`);
  const manifest = readManifest(dir);
  const copy = `replay/${manifest.name}-${String(process.pid)}`;
  const copyAbs = join(varDir(root), copy);
  const base = Date.parse(manifest.base);
  const started = clock();
  const elapsed = (): number => Math.min((clock() - started) * speed, manifest.durationMs);
  const now = (): number => base + elapsed();

  removeVarDir(copy, root);
  const all = filesUnder(dir);
  const present = new Set(all);
  const revealed = new Set(manifest.files.map((f) => f.path));
  const tracks: Track[] = [];
  const metas = new Set<string>();
  for (const rel of all) {
    if (rel.startsWith('config/') && rel.endsWith('.jsonl')) {
      const lines = splitLines(readFileSync(join(dir, rel), 'utf8'));
      let due = -Infinity;
      const meta = rel.replace(/\.jsonl$/, '.meta.json');
      const hasMeta = /\/agent-[^/]+\.jsonl$/.test(rel) && present.has(meta);
      if (hasMeta) metas.add(meta);
      tracks.push({
        rel,
        lines,
        due: lines.map((line) => (due = timestampOf(line) ?? due)),
        next: 0,
        meta: hasMeta ? meta : null,
      });
    }
  }
  // Everything else is there from the start, except files that appear later and late metas.
  for (const rel of all) {
    if (rel.startsWith('config/') && rel.endsWith('.jsonl')) continue;
    if (revealed.has(rel) || metas.has(rel)) continue;
    copyIntoVar(join(dir, rel), `${copy}/${rel}`, root);
  }
  const pending = [...manifest.files].sort((a, b) => a.appearsAtMs - b.appearsAtMs);

  function play(): void {
    const t = now();
    for (const track of tracks) {
      let end = track.next;
      while (end < track.lines.length && (track.due[end] ?? Infinity) <= t) end += 1;
      if (end > track.next) {
        appendVarFile(`${copy}/${track.rel}`, track.lines.slice(track.next, end).join(''), root);
        track.next = end;
      }
      if (track.meta !== null && track.next === track.lines.length) {
        copyIntoVar(join(dir, track.meta), `${copy}/${track.meta}`, root);
        track.meta = null;
      }
    }
    const offset = t - base;
    while (pending.length > 0 && (pending[0]?.appearsAtMs ?? Infinity) <= offset) {
      const file = pending.shift();
      if (file) copyIntoVar(join(dir, file.path), `${copy}/${file.as ?? file.path}`, root);
    }
  }

  let resolveDone: () => void = () => undefined;
  const done = new Promise<void>((resolve) => {
    resolveDone = resolve;
  });
  let timer: NodeJS.Timeout | undefined;
  const stop = (): void => {
    if (timer !== undefined) clearInterval(timer);
    timer = undefined;
    resolveDone();
  };
  const tick = (): void => {
    if (timer === undefined) return;
    play();
    if (elapsed() >= manifest.durationMs) {
      stop();
      log('replay finished');
    }
  };
  play();
  timer = setInterval(tick, TICK_MS); // ref'd: the replay keeps the process alive until done

  const roots = [...manifest.repos].sort((a, b) => b.root.length - a.root.length);
  const liveness: Liveness = {
    registry: async () => {
      const offset = elapsed();
      const out = new Map<string, RegistryEntry>();
      manifest.live.forEach((w, i) => {
        if (w.fromMs <= offset && offset <= w.toMs) {
          out.set(w.sessionId, { pid: 5000 + i, sessionId: w.sessionId, procStart: null, status: w.status ?? null, updatedAt: base + offset, cwd: null, name: null });
        }
      });
      return out;
    },
    teammates: async () => [],
  };

  return {
    manifest,
    cfgDir: join(copyAbs, 'config'),
    now,
    liveness,
    rootOf: (cwd) => roots.find((r) => cwd === r.root || cwd.startsWith(r.root + '/'))?.root ?? repoRoot(cwd),
    dirOf: (repo) => {
      const r = manifest.repos.find((x) => x.root === repo);
      return r && r.dir !== null ? join(copyAbs, r.dir) : repo;
    },
    done,
    close: stop,
  };
}
