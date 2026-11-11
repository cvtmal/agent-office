import { describe, expect, it } from 'vitest';
import { THRESHOLDS } from '../../shared/constants.js';
import { verdictFor } from '../../shared/verdict.js';
import { normalise, type Rec } from './records.js';
import { lastUsage, ThresholdEnvError, thresholdsFromEnv } from './tokens.js';

const BASE = Date.parse('2026-01-01T00:00:00Z');
const at = (seconds: number): string => new Date(BASE + seconds * 1000).toISOString();

function turn(seconds: number, usage: Record<string, unknown> | null, extra: Record<string, unknown> = {}): Rec {
  return normalise({
    type: 'assistant',
    timestamp: at(seconds),
    cwd: `/home/dev/project-${seconds}`,
    ...extra,
    message: { content: [], stop_reason: 'end_turn', ...(usage === null ? {} : { usage }) },
  });
}

const usage = (input: number, cacheCreation: number, cacheRead: number, output: number): Record<string, unknown> => ({
  input_tokens: input,
  cache_creation_input_tokens: cacheCreation,
  cache_read_input_tokens: cacheRead,
  output_tokens: output,
});

describe('lastUsage', () => {
  it('sums the four fields of the last assistant usage', () => {
    const records = [turn(1, usage(1, 1, 1, 1)), turn(2, usage(10, 200, 3000, 40000))];
    expect(lastUsage(records, 'session')).toEqual({ tokens: 43210, at: at(2), cwd: '/home/dev/project-2' });
  });

  it('skips a zero-usage last record', () => {
    const records = [turn(1, usage(5, 0, 0, 5)), turn(2, usage(0, 0, 0, 0))];
    expect(lastUsage(records, 'session')).toEqual({ tokens: 10, at: at(1), cwd: '/home/dev/project-1' });
  });

  it('ignores sidechain usage in a session file and uses it in an agent file', () => {
    const records = [turn(1, usage(1, 0, 0, 0)), turn(2, usage(2, 0, 0, 0), { isSidechain: true })];
    expect(lastUsage(records, 'session')?.tokens).toBe(1);
    expect(lastUsage(records, 'agent')?.tokens).toBe(2);
  });

  it('ignores usage on non-assistant records', () => {
    const records = [turn(1, usage(1, 0, 0, 0)), normalise({ type: 'user', message: { usage: usage(9, 0, 0, 0) } })];
    expect(lastUsage(records, 'session')?.tokens).toBe(1);
  });

  it('is null without usage', () => {
    expect(lastUsage([], 'session')).toBeNull();
    expect(lastUsage([turn(1, null), turn(2, usage(0, 0, 0, 0))], 'agent')).toBeNull();
  });
});

describe('thresholdsFromEnv', () => {
  it('returns THRESHOLDS when nothing is set', () => {
    expect(thresholdsFromEnv({})).toEqual(THRESHOLDS);
  });

  it('applies each set variable', () => {
    const thresholds = thresholdsFromEnv({
      HARNESS_TEAMMATE_WARN: '1000',
      HARNESS_TEAMMATE_RECYCLE: '2000',
      HARNESS_CTO_WARN: '3000',
      HARNESS_CTO_HANDOVER: '4000',
    });
    expect(thresholds).toEqual({ teammate: { warn: 1000, recycle: 2000 }, cto: { warn: 3000, handover: 4000 } });
  });

  it('changes the verdict', () => {
    expect(verdictFor(160_000, 'teammate', thresholdsFromEnv({}))).toBe('WARN');
    expect(verdictFor(160_000, 'teammate', thresholdsFromEnv({ HARNESS_TEAMMATE_RECYCLE: '155000' }))).toBe('RECYCLE');
  });

  it('throws naming the variable for a non-integer value', () => {
    expect(() => thresholdsFromEnv({ HARNESS_CTO_WARN: '12k' })).toThrow(ThresholdEnvError);
    expect(() => thresholdsFromEnv({ HARNESS_CTO_WARN: '12k' })).toThrow(/HARNESS_CTO_WARN.*12k/);
  });

  it('throws for an empty string', () => {
    expect(() => thresholdsFromEnv({ HARNESS_TEAMMATE_WARN: '' })).toThrow(/HARNESS_TEAMMATE_WARN/);
  });
});
