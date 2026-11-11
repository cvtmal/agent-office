// One scan of the Claude config dir into a Snapshot (research § Scope assumption 3).
// Read-only. Not routed yet: #3 wires it into the API. Harness extras come from `harness/` (#4).
import { homedir } from 'node:os';
import { MAX_AGE_HOURS } from '../shared/constants.js';
import type { HarnessExtras, Snapshot } from '../shared/types.js';
import { configDir, discover, readProcessTable, repoRoot, type ProcessRow } from './discovery/index.js';
import { readHarness } from './harness/index.js';
import { buildModel, type LiveBy } from './reader/model.js';
import { thresholdsFromEnv } from './reader/tokens.js';

export interface ScanOptions {
  env?: Readonly<Record<string, string | undefined>>;
  home?: string;
  now?: Date;
  maxAgeHours?: number;
  /** One process table per scan; null when `ps` failed. */
  table?: Map<number, ProcessRow> | null;
  rootOf?: (cwd: string) => string;
  /** Harness extras of a project root (DATA-6); default `readHarness` (read-only). */
  harnessOf?: (root: string) => HarnessExtras | null;
}

/** Thresholds from `env` (throws ThresholdEnvError on a bad value), then discover and build. */
export function scanSnapshot({
  env = process.env,
  home = homedir(),
  now = new Date(),
  maxAgeHours = MAX_AGE_HOURS,
  table = readProcessTable(),
  rootOf = (cwd) => repoRoot(cwd),
  harnessOf = (root) => readHarness(root),
}: ScanOptions = {}): { snapshot: Snapshot; liveBy: Map<string, LiveBy> } {
  const thresholds = thresholdsFromEnv({ ...env });
  const cfgDir = configDir(env, home);
  const input = discover({ cfgDir, now, maxAgeHours, table });
  return buildModel(input, { now, home, thresholds, rootOf, harnessOf });
}
