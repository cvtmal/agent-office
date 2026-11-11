import { describe, expect, it } from 'vitest';
import { parseLstart, parsePsOutput, readProcessTable, readProcessTableAsync } from './processes.js';

const SAMPLE = [
  '    1 Sun Nov  1 09:00:00 2026     /sbin/launchd',
  ' 4242 Wed Nov 11 08:30:05 2026 node /home/dev/bin/claude --agent-name dev --team-name core',
  '   99 Tue Nov 10 23:59:59 2026 /usr/bin/some tool   with  spaces',
  '',
].join('\n');

describe('parseLstart', () => {
  it('reads the five lstart tokens as UTC epoch seconds', () => {
    expect(parseLstart('Wed Nov 11 08:30:05 2026')).toBe(Date.UTC(2026, 10, 11, 8, 30, 5) / 1000);
  });

  it('accepts a double-space day and surrounding whitespace', () => {
    expect(parseLstart('  Sun Nov  1 09:00:00 2026\n')).toBe(Date.UTC(2026, 10, 1, 9, 0, 0) / 1000);
  });

  it('returns null for anything else', () => {
    expect(parseLstart('')).toBeNull();
    expect(parseLstart('yesterday')).toBeNull();
    expect(parseLstart('Wed Nov 11 08:30:05')).toBeNull();
    expect(parseLstart('Wed Nov 11 08:30:05 2026 extra')).toBeNull();
    expect(parseLstart('Xyz Nov 11 08:30:05 2026')).toBeNull();
    expect(parseLstart('Wed Foo 11 08:30:05 2026')).toBeNull();
    expect(parseLstart('Wed Nov 32 08:30:05 2026')).toBeNull();
    expect(parseLstart('Wed Nov 11 8h30 2026')).toBeNull();
  });
});

describe('parsePsOutput', () => {
  it('parses pid, start and the command with its spaces', () => {
    expect(parsePsOutput(SAMPLE)).toEqual([
      { pid: 1, startedAt: Date.UTC(2026, 10, 1, 9, 0, 0) / 1000, command: '/sbin/launchd' },
      {
        pid: 4242,
        startedAt: Date.UTC(2026, 10, 11, 8, 30, 5) / 1000,
        command: 'node /home/dev/bin/claude --agent-name dev --team-name core',
      },
      { pid: 99, startedAt: Date.UTC(2026, 10, 10, 23, 59, 59) / 1000, command: '/usr/bin/some tool   with  spaces' },
    ]);
  });

  it('skips lines without a pid and keeps an unparsable start as null', () => {
    expect(parsePsOutput('garbage line\n 7 a b c d e cmd')).toEqual([{ pid: 7, startedAt: null, command: 'cmd' }]);
  });
});

describe('readProcessTable', () => {
  it('lists this process, or returns null when ps is unavailable', () => {
    const table = readProcessTable();
    if (table !== null) expect(table.has(process.pid)).toBe(true);
  });
});

describe('readProcessTableAsync', () => {
  it('lists this process like the sync table, or returns null when ps is unavailable', async () => {
    const table = await readProcessTableAsync();
    if (table !== null) {
      expect(table.has(process.pid)).toBe(true);
      expect(table.get(process.pid)?.command).toBe(readProcessTable()?.get(process.pid)?.command);
    }
  });
});
