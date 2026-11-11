import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { syntheticUuid } from '../../fixtures/gen/sample.js';
import { parsePsOutput, repoRoot } from './discovery/index.js';
import { scanSnapshot } from './snapshot.js';

const FIXTURES = new URL('../../fixtures/transcripts/', import.meta.url);
const CONFIG = fileURLToPath(new URL('config/', FIXTURES));
const PS = readFileSync(new URL('ps.txt', FIXTURES), 'utf8');
const FAKE_GIT = new Set(['/home/dev/code/alpha/.git', '/home/dev/code/beta/.git']);

function scan(env: Record<string, string> = {}) {
  return scanSnapshot({
    env: { CLAUDE_CONFIG_DIR: CONFIG, ...env },
    home: '/home/dev',
    now: new Date('2026-01-01T06:00:00.000Z'),
    maxAgeHours: Infinity,
    table: new Map(parsePsOutput(PS).map((row) => [row.pid, row])),
    rootOf: (c) => repoRoot(c, (p) => FAKE_GIT.has(p)),
  });
}

describe('scanSnapshot', () => {
  it('scans the fixture config dir into two projects', () => {
    const { snapshot } = scan();
    expect(snapshot.projects.map((p) => [p.id, p.displayPath])).toEqual([
      ['/home/dev/code/alpha', '~/code/alpha'],
      ['/home/dev/code/beta', '~/code/beta'],
    ]);
    expect(snapshot.generatedAt).toBe('2026-01-01T06:00:00.000Z');
  });

  it('passes harnessOf through to every project (DATA-6)', () => {
    const H = { lanes: [], ctoGeneration: 1, phase: null, wave: 'W1', outcomes: [{ nn: 0, slug: 'a' }], lastCommit: null };
    const { snapshot } = scanSnapshot({
      env: { CLAUDE_CONFIG_DIR: CONFIG },
      home: '/home/dev',
      now: new Date('2026-01-01T06:00:00.000Z'),
      maxAgeHours: Infinity,
      table: new Map(parsePsOutput(PS).map((row) => [row.pid, row])),
      rootOf: (c) => repoRoot(c, (p) => FAKE_GIT.has(p)),
      harnessOf: () => H,
    });
    expect(snapshot.projects.map((p) => p.harness)).toEqual([H, H]);
  });

  it('marks the teammate session as live by teammate and registered sessions as live by registry', () => {
    const { liveBy } = scan();
    expect(liveBy.get(syntheticUuid('teammate'))).toBe('teammate');
    expect(liveBy.get(syntheticUuid('cto'))).toBe('registry');
    expect(liveBy.has(syntheticUuid('reused'))).toBe(false);
  });

  it('throws on a bad threshold value', () => {
    expect(() => scan({ HARNESS_CTO_WARN: '1e5' })).toThrow(/HARNESS_CTO_WARN/);
  });
});
