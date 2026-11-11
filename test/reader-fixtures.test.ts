// Fixture-level reader tests (plan Step 6.3): every unit case under fixtures/transcripts/cases/
// and the fake config dir fixtures/transcripts/config/ through the whole pipeline.
import { readdirSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { FAKE_SECRETS } from '../fixtures/gen/records.js';
import { syntheticUuid } from '../fixtures/gen/sample.js';
import { parsePsOutput, repoRoot } from '../src/server/discovery/index.js';
import type { Discovered, RegistryEntry } from '../src/server/discovery/types.js';
import { buildSnapshot } from '../src/server/reader/model.js';
import { ThresholdEnvError } from '../src/server/reader/tokens.js';
import { scanSnapshot } from '../src/server/snapshot.js';
import { THRESHOLDS, type ActivityKind, type Status, type Verdict } from '../src/shared/constants.js';
import type { Character, Snapshot } from '../src/shared/types.js';
import { validateSnapshot } from '../src/shared/validate.js';

const FIXTURES = new URL('../fixtures/transcripts/', import.meta.url);
const HOME = '/home/dev';
const ALPHA = '/home/dev/code/alpha';
const BETA = '/home/dev/code/beta';

// (a) unit cases ------------------------------------------------------------------------------

interface CaseExpect {
  status?: Status;
  tokens?: number;
  verdict?: Verdict;
  ctoVerdict?: Verdict;
  name?: string;
  kinds?: ActivityKind[];
  health?: { lines: number; failed: number; drift: boolean };
}

const CASES: Record<string, CaseExpect> = {
  'status-idle-end-turn': { status: 'idle' },
  'status-idle-stop-hook': { status: 'idle' },
  'status-busy-prompt': { status: 'busy' },
  'status-busy-tool-use': { status: 'busy' },
  'status-busy-tool-result': { status: 'busy' },
  'status-sidechain-last': { status: 'idle', tokens: 40_000 },
  'activity-kinds': {
    status: 'idle',
    kinds: ['read', 'write', 'shell', 'web', 'delegate', 'plan', 'other', 'web', 'other'],
  },
  'tokens-149999': { tokens: 149_999, verdict: 'OK', ctoVerdict: 'OK' },
  'tokens-150000': { tokens: 150_000, verdict: 'WARN', ctoVerdict: 'OK' },
  'tokens-180000': { tokens: 180_000, verdict: 'RECYCLE', ctoVerdict: 'OK' },
  'tokens-220000': { tokens: 220_000, verdict: 'RECYCLE', ctoVerdict: 'WARN' },
  'tokens-250000': { tokens: 250_000, verdict: 'RECYCLE', ctoVerdict: 'HANDOVER' },
  'tokens-zero-last': { tokens: 120_000 },
  'tokens-bad-values': { tokens: 90_000 },
  'health-drift': { health: { lines: 500, failed: 30, drift: true } },
  'health-ok': { health: { lines: 500, failed: 25, drift: false } },
  'health-old-garbage': { health: { lines: 500, failed: 0, drift: false } },
  'names-titles': { name: 'Release prep' },
  secrets: { status: 'idle' },
};

/** One case file as a registered session without a registry status (so the transcript rule applies). */
function caseSnapshot(name: string, registryName: string | null = null): Snapshot {
  const sessionId = syntheticUuid(`case:${name}`);
  const entry: RegistryEntry = { pid: 4199, sessionId, procStart: null, status: null, updatedAt: 0, cwd: null, name: registryName };
  const input: Discovered = {
    sessions: [
      {
        sessionId,
        path: `/home/dev/.claude/projects/cases/${sessionId}.jsonl`,
        mtimeMs: 0,
        text: readFileSync(new URL(`cases/${name}.jsonl`, FIXTURES), 'utf8'),
        customTitle: null,
      },
    ],
    agents: [],
    registry: new Map([[sessionId, entry]]),
    teammates: [],
  };
  return buildSnapshot(input, { now: new Date(0), home: HOME, thresholds: THRESHOLDS, rootOf: (cwd) => cwd });
}

describe('fixtures/transcripts/cases', () => {
  it('has an expectation for every case file', () => {
    const files = readdirSync(new URL('cases/', FIXTURES)).map((f) => f.replace(/\.jsonl$/, ''));
    expect(files.sort()).toEqual(Object.keys(CASES).sort());
  });

  for (const [name, want] of Object.entries(CASES)) {
    it(`${name} gives its named result`, () => {
      const snap = caseSnapshot(name);
      expect(validateSnapshot(snap)).toEqual([]);
      const [character] = snap.characters;
      expect(snap.characters).toHaveLength(1);
      if (want.status) expect(character?.status).toBe(want.status);
      if (want.tokens !== undefined) expect(character?.tokens).toBe(want.tokens);
      if (want.verdict) expect([character?.role, character?.verdict]).toEqual(['teammate', want.verdict]);
      if (want.ctoVerdict) {
        const cto = caseSnapshot(name, 'cto-case').characters[0];
        expect([cto?.role, cto?.verdict]).toEqual(['cto', want.ctoVerdict]);
      }
      if (want.name) expect(character?.name).toBe(want.name);
      if (want.kinds) expect(snap.activities.map((a) => a.kind)).toEqual(want.kinds);
      if (want.health) expect(snap.projects[0]?.health).toMatchObject(want.health);
    });
  }

  it('secrets.jsonl leaks no fake secret', () => {
    const text = JSON.stringify(caseSnapshot('secrets'));
    for (const secret of FAKE_SECRETS) expect(text).not.toContain(secret);
  });
});

// (b)–(e) the fake config dir ----------------------------------------------------------------

const PS = readFileSync(new URL('ps.txt', FIXTURES), 'utf8');
const FAKE_GIT = new Set([`${ALPHA}/.git`, `${BETA}/.git`]);

function scan(env: Record<string, string> = {}) {
  return scanSnapshot({
    env: { CLAUDE_CONFIG_DIR: fileURLToPath(new URL('config/', FIXTURES)), ...env },
    home: HOME,
    now: new Date('2026-01-01T06:00:00.000Z'),
    maxAgeHours: Infinity,
    table: new Map(parsePsOutput(PS).map((row) => [row.pid, row])),
    rootOf: (c) => repoRoot(c, (p) => FAKE_GIT.has(p)),
  });
}

const sid = (label: string) => syntheticUuid(label);
const aid = (label: string) => `a${syntheticUuid(label).replace(/-/g, '').slice(0, 16)}`;
const agentKey = (parent: string, label: string) => `${sid(parent)}/${aid(label)}`;

type Expect = Partial<Pick<Character, 'status' | 'name' | 'where' | 'role' | 'verdict' | 'projectId' | 'parentId'>>;

/** Step 5.2 "Expect" column; absent rows (`nousage`, `busy/nousage`) are dropped. */
const EXPECT: Record<string, Expect> = {
  [sid('cto')]: { status: 'idle', name: 'cto-1', role: 'cto', verdict: 'WARN', projectId: ALPHA },
  [sid('busy')]: { status: 'busy', projectId: ALPHA },
  [sid('waiting')]: { status: 'waiting', projectId: ALPHA },
  [sid('shell')]: { status: 'busy', projectId: ALPHA },
  [sid('nostatus')]: { status: 'idle', where: 'src', projectId: ALPHA },
  [sid('reused')]: { status: 'ended', projectId: ALPHA },
  [sid('ended')]: { status: 'ended', projectId: BETA },
  [sid('teammate')]: {
    status: 'busy',
    where: '.claude/worktrees/lane-a',
    name: 'c01-plan',
    role: 'teammate',
    verdict: 'OK',
    projectId: ALPHA,
  },
  [sid('titled')]: { status: 'ended', name: 'Night shift', projectId: BETA },
  [sid('drift')]: { status: 'ended', projectId: BETA },
  [sid('secrets')]: { status: 'idle', projectId: BETA },
  [agentKey('busy', 'busy/finished')]: { status: 'idle', parentId: sid('busy') },
  [agentKey('busy', 'busy/stopped')]: { status: 'stopped', parentId: sid('busy') },
  [agentKey('busy', 'busy/plain')]: { status: 'busy', parentId: sid('busy') },
  [agentKey('busy', 'busy/nested')]: { status: 'busy', parentId: sid('busy') },
  [agentKey('ended', 'ended/plain')]: { status: 'ended', parentId: sid('ended') },
  [agentKey('orphan', 'orphan/plain')]: { status: 'ended', parentId: null, projectId: BETA },
};

describe('scanSnapshot over fixtures/transcripts/config', () => {
  const { snapshot } = scan();

  it('keeps exactly the expected characters (nousage rows dropped)', () => {
    expect(snapshot.characters.map((c) => c.id)).toEqual(Object.keys(EXPECT).sort());
  });

  for (const [id, want] of Object.entries(EXPECT)) {
    it(`${id} matches the inventory`, () => {
      expect(snapshot.characters.find((c) => c.id === id)).toMatchObject(want);
    });
  }

  it('names unnamed sessions by the first 8 characters of their id', () => {
    expect(snapshot.characters.find((c) => c.id === sid('busy'))?.name).toBe(sid('busy').slice(0, 8));
  });

  it('has two projects with home-relative display paths; beta drifts, alpha does not', () => {
    expect(snapshot.projects.map((p) => [p.id, p.name, p.displayPath, p.health.drift])).toEqual([
      [ALPHA, 'alpha', '~/code/alpha', false],
      [BETA, 'beta', '~/code/beta', true],
    ]);
  });

  it('is a valid snapshot', () => {
    expect(validateSnapshot(snapshot)).toEqual([]);
  });

  it('leaks no fake secret', () => {
    const text = JSON.stringify(snapshot);
    for (const secret of FAKE_SECRETS) expect(text).not.toContain(secret);
  });

  it('HARNESS_TEAMMATE_WARN flips the teammate verdict; a bad value throws', () => {
    const lowered = scan({ HARNESS_TEAMMATE_WARN: '100' }).snapshot;
    expect(lowered.characters.find((c) => c.id === sid('teammate'))?.verdict).toBe('WARN');
    expect(() => scan({ HARNESS_TEAMMATE_WARN: 'lots' })).toThrow(ThresholdEnvError);
  });
});
