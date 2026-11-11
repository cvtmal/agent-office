// discovery: finds transcripts, subagents and live sessions in the config dir
// (read-only). The only IO result the reader sees is `Discovered`.
import { readTranscripts } from './files.js';
import type { ProcessRow } from './processes.js';
import { liveRegistry } from './registry.js';
import { teammateProcs } from './teammates.js';
import type { Discovered } from './types.js';

export type { AgentMeta, Discovered, RawAgent, RawSession, RegistryEntry, TeammateProc } from './types.js';
export { configDir } from './config-dir.js';
export { parseLstart, parsePsOutput, readProcessTable, type ProcessRow } from './processes.js';
export { liveRegistry, pidAlive } from './registry.js';
export { teammateProcs } from './teammates.js';
export { displayPath, repoRoot, whereIn } from './repo-root.js';

export interface DiscoverOptions {
  cfgDir: string;
  now: Date;
  maxAgeHours: number;
  /** One `readProcessTable()` per scan; null when `ps` failed. */
  table: Map<number, ProcessRow> | null;
}

/** One scan of the config dir: transcripts in the age window, live registry, teammates. */
export function discover({ cfgDir, now, maxAgeHours, table }: DiscoverOptions): Discovered {
  const registry = liveRegistry(cfgDir, table);
  const { sessions, agents } = readTranscripts({
    cfgDir,
    cutoffMs: now.getTime() - maxAgeHours * 3600 * 1000,
    isLive: (sessionId) => registry.has(sessionId),
  });
  return { sessions, agents, registry, teammates: table ? teammateProcs(table) : [] };
}
