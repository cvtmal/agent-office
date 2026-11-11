/**
 * Context tokens of a transcript and the threshold environment (scope DATA-4, research D6).
 * Pure: no file or process access; the environment is passed in.
 */
import { THRESHOLD_ENV, THRESHOLDS } from '../../shared/constants.js';
import type { Thresholds } from '../../shared/verdict.js';
import { mainRecords, type FileKind, type Rec } from './records.js';

/** The last real usage of a transcript. */
export interface LastUsage {
  tokens: number;
  at: string | null;
  cwd: string | null;
}

/** The last assistant record with a usage whose four-field sum is > 0 (zero usage is synthetic); else null. */
export function lastUsage(records: Rec[], kind: FileKind): LastUsage | null {
  const main = mainRecords(records, kind);
  for (let i = main.length - 1; i >= 0; i--) {
    const rec = main[i];
    if (rec === undefined || rec.type !== 'assistant' || rec.usage === null) {
      continue;
    }
    const { input, cacheCreation, cacheRead, output } = rec.usage;
    const tokens = input + cacheCreation + cacheRead + output;
    if (tokens > 0) {
      return { tokens, at: rec.timestamp, cwd: rec.cwd };
    }
  }
  return null;
}

/** A threshold variable that is set but not a plain integer. */
export class ThresholdEnvError extends Error {
  constructor(
    readonly variable: string,
    readonly value: string,
  ) {
    super(`${variable} must be a plain integer, got ${JSON.stringify(value)}`);
    this.name = 'ThresholdEnvError';
  }
}

const PLAIN_INTEGER = /^\d+$/;

function override(env: Record<string, string | undefined>, variable: string, fallback: number): number {
  const value = env[variable];
  if (value === undefined) {
    return fallback;
  }
  if (!PLAIN_INTEGER.test(value)) {
    throw new ThresholdEnvError(variable, value);
  }
  return Number(value);
}

/** THRESHOLDS with each set THRESHOLD_ENV variable applied; throws ThresholdEnvError on a non-integer value. */
export function thresholdsFromEnv(env: Record<string, string | undefined>): Thresholds {
  return {
    teammate: {
      warn: override(env, THRESHOLD_ENV.teammateWarn, THRESHOLDS.teammate.warn),
      recycle: override(env, THRESHOLD_ENV.teammateRecycle, THRESHOLDS.teammate.recycle),
    },
    cto: {
      warn: override(env, THRESHOLD_ENV.ctoWarn, THRESHOLDS.cto.warn),
      handover: override(env, THRESHOLD_ENV.ctoHandover, THRESHOLDS.cto.handover),
    },
  };
}
