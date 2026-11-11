import { describe, expect, it, vi } from 'vitest';
import { ACTIVITIES_PER_CHARACTER, SNAPSHOT_VERSION, THRESHOLDS } from '../../shared/constants.js';
import type { HarnessExtras } from '../../shared/types.js';
import { validateSnapshot } from '../../shared/validate.js';
import type { AgentMeta, Discovered, RawAgent, RawSession, RegistryEntry } from '../discovery/types.js';
import { buildModel, buildSnapshot, type ModelOptions } from './model.js';

const ROOT = '/home/dev/code/app';
const OTHER = '/home/dev/code/other';
const T0 = Date.parse('2026-01-01T00:00:00.000Z');

const opts: ModelOptions = {
  now: new Date('2026-01-01T12:00:00.000Z'),
  home: '/home/dev',
  thresholds: THRESHOLDS,
  rootOf: (cwd) => {
    const at = cwd.indexOf('/.claude/worktrees/');
    if (at >= 0) return cwd.slice(0, at);
    return cwd.startsWith(OTHER) ? OTHER : ROOT;
  },
};

type Line = Record<string, unknown>;
const at = (s: number) => new Date(T0 + s * 1000).toISOString();

function assistant(s: number, cwd: string, tokens: number, block: Line, stop: string | null, extra: Line = {}): Line {
  return {
    type: 'assistant',
    timestamp: at(s),
    cwd,
    gitBranch: 'main',
    version: '9.9.1',
    ...extra,
    message: {
      content: [block],
      stop_reason: stop,
      usage: { input_tokens: tokens, cache_creation_input_tokens: 0, cache_read_input_tokens: 0, output_tokens: 0 },
    },
  };
}
const read = (s: number, cwd: string, tokens: number, extra: Line = {}) =>
  assistant(s, cwd, tokens, { type: 'tool_use', name: 'Read', input: { file_path: `${cwd}/f${s}.ts` } }, 'tool_use', extra);
const done = (s: number, cwd: string, tokens: number, extra: Line = {}) =>
  assistant(s, cwd, tokens, { type: 'text', text: 'ok' }, 'end_turn', extra);
const prompt = (s: number, cwd: string): Line => ({ type: 'user', timestamp: at(s), cwd, message: { content: 'go' } });
const jsonl = (lines: Line[]) => lines.map((l) => JSON.stringify(l)).join('\n') + '\n';

function session(sessionId: string, lines: Line[], over: Partial<RawSession> = {}): RawSession {
  return { sessionId, path: `/x/${sessionId}.jsonl`, mtimeMs: T0, text: jsonl(lines), customTitle: null, ...over };
}
function agent(sessionId: string, agentId: string, lines: Line[], meta: Partial<AgentMeta> | null = {}): RawAgent {
  return {
    sessionId,
    agentId,
    path: `/x/${sessionId}/subagents/agent-${agentId}.jsonl`,
    mtimeMs: T0,
    text: jsonl(lines),
    meta: meta === null ? null : { agentType: 'Explore', description: null, name: null, finished: false, stoppedByUser: false, ...meta },
  };
}
function reg(sessionId: string, over: Partial<RegistryEntry> = {}): [string, RegistryEntry] {
  return [sessionId, { pid: 1, sessionId, procStart: null, status: 'busy', updatedAt: 0, cwd: ROOT, name: null, ...over }];
}
function input(over: Partial<Discovered>): Discovered {
  return { sessions: [], agents: [], registry: new Map(), teammates: [], ...over };
}

describe('buildModel', () => {
  it('groups a worktree session under its parent repo with a relative where', () => {
    const wt = `${ROOT}/.claude/worktrees/lane-a`;
    const snap = buildSnapshot(
      input({ sessions: [session('s-main', [done(1, ROOT, 1000)]), session('s-wt', [done(2, wt, 2000)])] }),
      opts,
    );
    expect(snap.projects.map((p) => [p.id, p.name, p.displayPath])).toEqual([[ROOT, 'app', '~/code/app']]);
    expect(snap.characters.map((c) => [c.id, c.projectId, c.where])).toEqual([
      ['s-main', ROOT, '.'],
      ['s-wt', ROOT, '.claude/worktrees/lane-a'],
    ]);
    expect(snap.version).toBe(SNAPSHOT_VERSION);
    expect(snap.generatedAt).toBe('2026-01-01T12:00:00.000Z');
    expect(validateSnapshot(snap)).toEqual([]);
  });

  it('drops a non-live session without usage and a live one without any cwd; keeps a live one without usage', () => {
    const snap = buildSnapshot(
      input({
        sessions: [
          session('gone', [prompt(1, ROOT)]),
          session('live-nousage', [prompt(1, ROOT)]),
          session('live-nocwd', [{ type: 'user', timestamp: at(1), message: { content: 'go' } }]),
        ],
        registry: new Map([reg('live-nousage'), reg('live-nocwd', { cwd: null })]),
      }),
      opts,
    );
    expect(snap.characters.map((c) => [c.id, c.status, c.tokens, c.lastUsageAt, c.cwd])).toEqual([
      ['live-nousage', 'busy', 0, null, ROOT],
    ]);
  });

  it('builds agents: ids, parentId, cwd fallback, status, dropped without usage, orphan parentId null', () => {
    const snap = buildSnapshot(
      input({
        sessions: [session('p', [read(1, ROOT, 5000)])],
        agents: [
          agent('p', 'a1', [done(2, ROOT, 3000)], { finished: true }),
          agent('p', 'a2', [read(3, ROOT, 3000)], { stoppedByUser: true }),
          agent('p', 'a3', [prompt(4, ROOT)]),
          agent('orphan', 'a4', [read(5, OTHER, 1000)]),
          agent('orphan', 'a5', [{ ...read(6, OTHER, 1000), cwd: undefined }]),
        ],
        registry: new Map([reg('p')]),
      }),
      opts,
    );
    expect(snap.characters.map((c) => [c.id, c.kind, c.parentId, c.status, c.agentType, c.projectId])).toEqual([
      ['orphan/a4', 'agent', null, 'ended', 'Explore', OTHER],
      ['p', 'session', null, 'busy', null, ROOT],
      ['p/a1', 'agent', 'p', 'idle', 'Explore', ROOT],
      ['p/a2', 'agent', 'p', 'stopped', 'Explore', ROOT],
    ]);
    expect(snap.projects.map((p) => p.id)).toEqual([ROOT, OTHER].sort());
  });

  it('uses the parent session cwd when an agent has none of its own', () => {
    const noCwd = { ...read(2, ROOT, 3000) };
    delete noCwd.cwd;
    const snap = buildSnapshot(
      input({ sessions: [session('p', [done(1, OTHER, 5000)])], agents: [agent('p', 'a1', [noCwd])] }),
      opts,
    );
    expect(snap.characters.find((c) => c.id === 'p/a1')?.cwd).toBe(OTHER);
  });

  it('assigns role and verdict from the name and thresholds', () => {
    const snap = buildSnapshot(
      input({
        sessions: [session('cto-sid', [done(1, ROOT, 230_000)]), session('tm', [done(2, ROOT, 160_000)])],
        agents: [agent('cto-sid', 'a1', [done(3, ROOT, 190_000)], { name: 'cto-helper' })],
        registry: new Map([reg('cto-sid', { name: 'cto-1', status: 'idle' })]),
      }),
      opts,
    );
    expect(snap.characters.map((c) => [c.id, c.name, c.role, c.verdict])).toEqual([
      ['cto-sid', 'cto-1', 'cto', 'WARN'],
      ['cto-sid/a1', 'cto-helper', 'teammate', 'RECYCLE'],
      ['tm', 'tm', 'teammate', 'WARN'],
    ]);
    const lower = buildSnapshot(
      input({ sessions: [session('tm', [done(2, ROOT, 160_000)])] }),
      { ...opts, thresholds: { ...THRESHOLDS, teammate: { warn: 170_000, recycle: 200_000 } } },
    );
    expect(lower.characters[0]?.verdict).toBe('OK');
  });

  it('caps activities per character and sorts them by time, then character', () => {
    const many = Array.from({ length: ACTIVITIES_PER_CHARACTER + 5 }, (_, i) => read(i + 1, ROOT, 1000 + i));
    const snap = buildSnapshot(
      input({ sessions: [session('b', many), session('a', [read(3, ROOT, 10)])] }),
      opts,
    );
    const ofB = snap.activities.filter((a) => a.characterId === 'b');
    expect(ofB).toHaveLength(ACTIVITIES_PER_CHARACTER);
    expect(ofB[0]?.at).toBe(at(6));
    expect(snap.activities.slice(0, 2).map((a) => [a.characterId, a.at])).toEqual([
      ['a', at(3)],
      ['b', at(6)],
    ]);
    const b = snap.characters.find((c) => c.id === 'b');
    expect(b?.lastActivityAt).toBe(at(ACTIVITIES_PER_CHARACTER + 5));
    expect(b?.lastUsageAt).toBe(at(ACTIVITIES_PER_CHARACTER + 5));
  });

  it('marks the newest matching session as teammate-live and takes team and branch from the newest records', () => {
    const team = { agentName: 'c01-plan', teamName: 'session-x' };
    const { snapshot, liveBy } = buildModel(
      input({
        sessions: [
          session('old', [read(1, ROOT, 1000, team)], { mtimeMs: T0 }),
          session('new', [read(2, ROOT, 1000, { ...team, gitBranch: 'lane-a' })], { mtimeMs: T0 + 1 }),
          session('other', [read(3, ROOT, 1000, { agentName: 'c02', teamName: 'session-x' })], { mtimeMs: T0 + 2 }),
        ],
        teammates: [team],
        registry: new Map([reg('reg')]),
      }),
      opts,
    );
    expect([...liveBy].sort()).toEqual([
      ['new', 'teammate'],
      ['reg', 'registry'],
    ]);
    expect(snapshot.characters.map((c) => [c.id, c.status, c.name, c.teamName, c.gitBranch])).toEqual([
      ['new', 'busy', 'c01-plan', 'session-x', 'lane-a'],
      ['old', 'ended', 'c01-plan', 'session-x', 'main'],
      ['other', 'ended', 'c02', 'session-x', 'main'],
    ]);
  });

  it('merges project health over the kept transcripts only', () => {
    const garbage = 'not json\n'.repeat(10);
    const snap = buildSnapshot(
      input({
        sessions: [
          session('kept', [done(1, ROOT, 1000)]),
          { ...session('dropped', [prompt(1, ROOT)]), text: jsonl([prompt(1, ROOT)]) + garbage },
        ],
      }),
      opts,
    );
    expect(snap.projects[0]?.health).toEqual({ lines: 1, failed: 0, drift: false, version: '9.9.1' });
  });
});

describe('buildModel harness extras (DATA-6)', () => {
  const HARNESS: HarnessExtras = {
    lanes: [
      { slug: 'alpha', letter: 'A', port: 8001, worktree: '.claude/worktrees/alpha' },
      { slug: 'beta', letter: 'B', port: 8002, worktree: '.claude/worktrees/beta' },
    ],
    ctoGeneration: 2,
    phase: 'W1',
    wave: 'W1',
    outcomes: [{ nn: 0, slug: 'bootstrap' }],
    lastCommit: null,
  };
  const alpha = `${ROOT}/.claude/worktrees/alpha`;
  const gamma = `${ROOT}/.claude/worktrees/gamma`;
  const sessions = [
    session('s-alpha', [done(1, alpha, 1000)]),
    session('s-main', [done(2, ROOT, 1000)]),
    session('s-gamma', [done(3, gamma, 1000)]),
  ];
  const agents = [agent('s-alpha', 'a1', [done(4, alpha, 500)])];

  it('gives lane sessions and their agents the lane, others null, and the project its harness', () => {
    const harnessOf = vi.fn((root: string) => (root === ROOT ? HARNESS : null));
    const snap = buildSnapshot(input({ sessions, agents }), { ...opts, harnessOf });
    const laneById = Object.fromEntries(snap.characters.map((c) => [c.id, c.lane]));
    expect(laneById).toEqual({
      's-alpha': { slug: 'alpha', letter: 'A', port: 8001 },
      's-alpha/a1': { slug: 'alpha', letter: 'A', port: 8001 },
      's-main': null,
      's-gamma': null,
    });
    expect(snap.projects.map((p) => p.harness)).toEqual([HARNESS]);
    expect(harnessOf).toHaveBeenCalledTimes(1);
    expect(validateSnapshot(snap)).toEqual([]);
  });

  it('shows sessions only for a non-harness repo', () => {
    const snap = buildSnapshot(input({ sessions, agents }), { ...opts, harnessOf: () => null });
    expect(snap.projects.map((p) => p.harness)).toEqual([null]);
    expect(snap.characters.map((c) => c.lane)).toEqual([null, null, null, null]);
    expect(validateSnapshot(snap)).toEqual([]);
  });
});
