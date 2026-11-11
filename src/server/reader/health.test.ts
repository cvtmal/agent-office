import { describe, expect, it } from 'vitest';
import { mergeHealth, transcriptHealth, type TranscriptHealth } from './health.js';
import { parseTranscript } from './records.js';

const good = (n: number, extra: Record<string, unknown> = {}): string[] =>
  Array.from({ length: n }, () => JSON.stringify({ type: 'user', ...extra }));
const garbled = (n: number): string[] => Array.from({ length: n }, () => '{"type": "user", "mess');

function health(lines: string[]): TranscriptHealth {
  return transcriptHealth(parseTranscript(lines.join('\n')));
}

describe('transcriptHealth', () => {
  it('counts the last 500 lines and their failures', () => {
    expect(health([...good(470), ...garbled(30)])).toMatchObject({ lines: 500, failed: 30 });
  });

  it('ignores lines before the window', () => {
    expect(health([...garbled(200), ...good(500)])).toMatchObject({ lines: 500, failed: 0 });
  });

  it('takes the version and its time from the last record carrying one', () => {
    const lines = [
      JSON.stringify({ type: 'user', version: '2.1.0', timestamp: '2026-01-01T00:00:01Z' }),
      JSON.stringify({ type: 'user', version: '2.1.1', timestamp: '2026-01-01T00:00:02Z' }),
      JSON.stringify({ type: 'ai-title' }),
    ];
    expect(health(lines)).toEqual({ lines: 3, failed: 0, version: '2.1.1', versionAt: '2026-01-01T00:00:02.000Z' });
  });

  it('has no version when no record carries one', () => {
    expect(health(good(2))).toEqual({ lines: 2, failed: 0, version: null, versionAt: null });
  });
});

describe('mergeHealth', () => {
  it('drifts with 30 failed lines in the last 500', () => {
    expect(mergeHealth([health([...good(470), ...garbled(30)])]).drift).toBe(true);
  });

  it('does not drift with 25 failed lines in the last 500 (5 % is not above)', () => {
    expect(mergeHealth([health([...good(475), ...garbled(25)])]).drift).toBe(false);
  });

  it('does not drift with 200 garbled lines followed by 500 good ones', () => {
    expect(mergeHealth([health([...garbled(200), ...good(500)])]).drift).toBe(false);
  });

  it('sums lines and failures across transcripts', () => {
    const merged = mergeHealth([health([...good(90), ...garbled(10)]), health(good(100))]);
    expect(merged).toEqual({ lines: 200, failed: 10, drift: false, version: null });
  });

  it('does not drift with no lines', () => {
    expect(mergeHealth([])).toEqual({ lines: 0, failed: 0, drift: false, version: null });
  });

  it('takes the version of the newest transcript', () => {
    const newer = health(good(1, { version: '2.2.0', timestamp: '2026-01-02T00:00:00Z' }));
    const older = health(good(1, { version: '2.1.0', timestamp: '2026-01-01T00:00:00Z' }));
    expect(mergeHealth([newer, older]).version).toBe('2.2.0');
    expect(mergeHealth([older, newer]).version).toBe('2.2.0');
  });

  it('breaks ties and missing times by the last in the list', () => {
    const a: TranscriptHealth = { lines: 1, failed: 0, version: 'a', versionAt: '2026-01-01T00:00:00.000Z' };
    const b: TranscriptHealth = { lines: 1, failed: 0, version: 'b', versionAt: '2026-01-01T00:00:00.000Z' };
    const c: TranscriptHealth = { lines: 1, failed: 0, version: 'c', versionAt: null };
    const d: TranscriptHealth = { lines: 1, failed: 0, version: 'd', versionAt: null };
    expect(mergeHealth([a, b]).version).toBe('b');
    expect(mergeHealth([c, d]).version).toBe('d');
    expect(mergeHealth([a, c]).version).toBe('a');
  });

  it('ignores transcripts without a version', () => {
    const versioned = health(good(1, { version: '2.1.0', timestamp: '2026-01-01T00:00:00Z' }));
    expect(mergeHealth([versioned, health(good(1))]).version).toBe('2.1.0');
  });
});
