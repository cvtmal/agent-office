/**
 * Transcript-format health (research D7, scope DATA-8).
 * Pure: no file or process access.
 */
import { DRIFT_RATIO, DRIFT_WINDOW_LINES } from '../../shared/constants.js';
import type { FormatHealth } from '../../shared/types.js';
import type { ParsedTranscript } from './records.js';

/** Health of one transcript over its last DRIFT_WINDOW_LINES lines. */
export interface TranscriptHealth {
  lines: number;
  failed: number;
  /** `version` of the last record carrying one. */
  version: string | null;
  /** Timestamp of that record. */
  versionAt: string | null;
}

export function transcriptHealth(p: ParsedTranscript): TranscriptHealth {
  const window = p.lineOk.slice(-DRIFT_WINDOW_LINES);
  const failed = window.filter((ok) => !ok).length;
  let version: string | null = null;
  let versionAt: string | null = null;
  for (let i = p.records.length - 1; i >= 0; i--) {
    const rec = p.records[i];
    if (rec !== undefined && rec.version !== null) {
      version = rec.version;
      versionAt = rec.timestamp;
      break;
    }
  }
  return { lines: window.length, failed, version, versionAt };
}

/** Is `a` at least as new as `b`? A null time is older than any time; equal times count as at least as new. */
function notOlder(a: string | null, b: string | null): boolean {
  if (a === null) {
    return b === null;
  }
  return b === null || a >= b;
}

/** Project health: sums; drift above DRIFT_RATIO; version of the entry with the newest versionAt (ties/nulls: last). */
export function mergeHealth(list: TranscriptHealth[]): FormatHealth {
  let lines = 0;
  let failed = 0;
  let newest: TranscriptHealth | null = null;
  for (const health of list) {
    lines += health.lines;
    failed += health.failed;
    if (health.version !== null && (newest === null || notOlder(health.versionAt, newest.versionAt))) {
      newest = health;
    }
  }
  return { lines, failed, drift: lines > 0 && failed / lines > DRIFT_RATIO, version: newest?.version ?? null };
}
