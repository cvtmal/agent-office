// A replay set's `manifest.json` (research R8, Q-E): read and validated. The shape is a copy of
// `fixtures/gen/replay.ts` `Manifest` (server code may not import `fixtures/`); keep them in step.
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

export interface LiveWindow {
  sessionId: string;
  fromMs: number;
  toMs: number;
  status?: string;
}

export interface ManifestFile {
  /** Set-relative path of the file. */
  path: string;
  /** Offset (ms after `base`) at which the file appears. */
  appearsAtMs: number;
  /** Set-relative path the file replaces when it appears (D-020); the file then never exists at `path`. */
  as?: string;
}

export interface Manifest {
  name: string;
  /** ISO time of offset 0; every record timestamp is `base + offset`. */
  base: string;
  durationMs: number;
  home: string;
  /** Repositories of the set; `dir` is the set-relative folder holding its files, or null. */
  repos: { root: string; dir: string | null }[];
  /** When each session counts as live (replaces registry files and pids). */
  live: LiveWindow[];
  /** Repo files that appear mid-run; a file not listed is present from the start. */
  files: ManifestFile[];
}

export class ManifestError extends Error {
  constructor(file: string, field: string, problem: string) {
    super(`${file}: ${field}: ${problem}`);
    this.name = 'ManifestError';
  }
}

type Obj = Record<string, unknown>;

const isObj = (v: unknown): v is Obj => typeof v === 'object' && v !== null && !Array.isArray(v);

/** A set-relative path: not empty, not absolute, no `..` segment. */
const isRelPath = (v: unknown): v is string =>
  typeof v === 'string' && v !== '' && !v.startsWith('/') && !v.split(/[\\/]/).includes('..');

const isOffset = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v) && v >= 0;

/** Validates parsed JSON as a manifest; throws `ManifestError` naming the first bad field. */
export function parseManifest(value: unknown, file = 'manifest.json'): Manifest {
  const bad = (field: string, problem: string): never => {
    throw new ManifestError(file, field, problem);
  };
  if (!isObj(value)) return bad('(root)', 'expected an object');
  const { name, base, durationMs, home, repos, live, files } = value;
  if (typeof name !== 'string' || name === '') bad('name', 'expected a non-empty string');
  if (typeof base !== 'string' || Number.isNaN(Date.parse(base))) bad('base', 'expected an ISO time');
  if (!isOffset(durationMs) || durationMs === 0) bad('durationMs', 'expected a number greater than 0');
  if (typeof home !== 'string' || !home.startsWith('/')) bad('home', 'expected an absolute path');
  if (!Array.isArray(repos)) return bad('repos', 'expected an array');
  repos.forEach((r: unknown, i) => {
    if (!isObj(r)) return bad(`repos[${String(i)}]`, 'expected an object');
    if (typeof r.root !== 'string' || !r.root.startsWith('/')) bad(`repos[${String(i)}].root`, 'expected an absolute path');
    if (r.dir !== null && !isRelPath(r.dir)) bad(`repos[${String(i)}].dir`, 'expected a set-relative path or null');
  });
  if (!Array.isArray(live)) return bad('live', 'expected an array');
  live.forEach((w: unknown, i) => {
    if (!isObj(w)) return bad(`live[${String(i)}]`, 'expected an object');
    if (typeof w.sessionId !== 'string' || w.sessionId === '') bad(`live[${String(i)}].sessionId`, 'expected a non-empty string');
    if (!isOffset(w.fromMs)) bad(`live[${String(i)}].fromMs`, 'expected a number ≥ 0');
    if (!isOffset(w.toMs) || (isOffset(w.fromMs) && w.toMs < w.fromMs)) bad(`live[${String(i)}].toMs`, 'expected a number ≥ fromMs');
    if (w.status !== undefined && typeof w.status !== 'string') bad(`live[${String(i)}].status`, 'expected a string');
  });
  if (!Array.isArray(files)) return bad('files', 'expected an array');
  files.forEach((f: unknown, i) => {
    if (!isObj(f)) return bad(`files[${String(i)}]`, 'expected an object');
    if (!isRelPath(f.path)) bad(`files[${String(i)}].path`, 'expected a set-relative path');
    if (!isOffset(f.appearsAtMs)) bad(`files[${String(i)}].appearsAtMs`, 'expected a number ≥ 0');
    if (f.as !== undefined && !isRelPath(f.as)) bad(`files[${String(i)}].as`, 'expected a set-relative path');
  });
  return value as unknown as Manifest;
}

/** Reads and validates `<dir>/manifest.json`; throws `ManifestError` naming the bad field. */
export function readManifest(dir: string): Manifest {
  const file = join(dir, 'manifest.json');
  let text: string;
  try {
    text = readFileSync(file, 'utf8');
  } catch {
    throw new ManifestError(file, '(file)', 'cannot be read');
  }
  let value: unknown;
  try {
    value = JSON.parse(text);
  } catch (error) {
    throw new ManifestError(file, '(json)', error instanceof Error ? error.message : String(error));
  }
  return parseManifest(value, file);
}
