// The live-session registry `<config>/sessions/*.json` (ctx:235-249), read-only.
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { parseLstart, type ProcessRow } from './processes.js';
import type { RegistryEntry } from './types.js';

export type KillProbe = (pid: number) => boolean;

/** `kill(pid, 0)`: alive when it succeeds or fails with EPERM (owned by someone else). */
export const killProbe: KillProbe = (pid) => {
  if (pid <= 0) return false;
  try {
    process.kill(pid, 0);
    return true;
  } catch (error) {
    return (error as NodeJS.ErrnoException).code === 'EPERM';
  }
};

/**
 * Whether `pid` runs and is the process the registry recorded (pid-reuse guard:
 * start time within 2 s of `procStart`). Without a process table, `kill(pid, 0)` decides.
 */
export function pidAlive(
  pid: number,
  procStart: string | null,
  table: Map<number, ProcessRow> | null,
  probe: KillProbe = killProbe,
): boolean {
  if (table === null) return probe(pid);
  const row = table.get(pid);
  if (!row) return false;
  const want = procStart === null ? null : parseLstart(procStart);
  if (want === null || row.startedAt === null) return true;
  return Math.abs(row.startedAt - want) <= 2;
}

function str(value: unknown): string | null {
  return typeof value === 'string' ? value : null;
}

function readEntry(path: string): RegistryEntry | null {
  let value: unknown;
  try {
    value = JSON.parse(readFileSync(path, 'utf8'));
  } catch {
    return null;
  }
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return null;
  const raw = value as Record<string, unknown>;
  const { pid, sessionId, updatedAt } = raw;
  if (typeof pid !== 'number' || !Number.isInteger(pid) || typeof sessionId !== 'string') return null;
  return {
    pid,
    sessionId,
    procStart: str(raw['procStart']),
    status: str(raw['status']),
    updatedAt: typeof updatedAt === 'number' && Number.isFinite(updatedAt) ? updatedAt : 0,
    cwd: str(raw['cwd']),
    name: str(raw['name']),
  };
}

/** sessionId → registry entry, for sessions whose process is alive; newest `updatedAt` wins. */
export function liveRegistry(
  cfgDir: string,
  table: Map<number, ProcessRow> | null,
  probe: KillProbe = killProbe,
): Map<string, RegistryEntry> {
  const live = new Map<string, RegistryEntry>();
  const dir = join(cfgDir, 'sessions');
  let names: string[];
  try {
    names = readdirSync(dir).filter((name) => name.endsWith('.json')).sort();
  } catch {
    return live;
  }
  for (const name of names) {
    const entry = readEntry(join(dir, name));
    if (!entry || !pidAlive(entry.pid, entry.procStart, table, probe)) continue;
    const old = live.get(entry.sessionId);
    if (!old || entry.updatedAt >= old.updatedAt) live.set(entry.sessionId, entry);
  }
  return live;
}
