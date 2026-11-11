import { describe, expect, it } from 'vitest';
import { syntheticUuid } from '../../fixtures/gen/sample.js';
import type { Character } from '../shared/types.js';
import { diffCtx, summary, type CtxRow } from './compare-ctx.js';
import type { LiveBy } from './reader/model.js';

const PROJECT = '/synthetic/repo';
const S1 = syntheticUuid('compare-ctx-s1');
const S2 = syntheticUuid('compare-ctx-s2');
const A1 = 'a0000000000000001';

function character(sessionId: string, agentId: string | null, over: Partial<Character> = {}): Character {
  return {
    id: agentId === null ? sessionId : `${sessionId}/${agentId}`,
    sessionId,
    agentId,
    parentId: agentId === null ? null : sessionId,
    projectId: PROJECT,
    kind: agentId === null ? 'session' : 'agent',
    role: 'teammate',
    name: 'synthetic',
    status: 'busy',
    tokens: 1000,
    verdict: 'OK',
    cwd: null,
    where: '.',
    gitBranch: null,
    agentType: null,
    teamName: null,
    lane: null,
    lastActivityAt: null,
    lastUsageAt: null,
    ...over,
  };
}

function row(sessionId: string, agentId: string | null, over: Partial<CtxRow> = {}): CtxRow {
  return {
    kind: agentId === null ? 'session' : 'agent',
    status: 'busy',
    tokens: 1000,
    verdict: 'OK',
    session_id: sessionId,
    agent_id: agentId,
    ...over,
  };
}

const none = new Map<string, LiveBy>();

describe('diffCtx', () => {
  it('match: same status, tokens and verdict; agent key is session/agent', () => {
    const lines = diffCtx([row(S1, null), row(S1, A1)], [character(S1, null), character(S1, A1)], none, PROJECT);
    expect(lines).toEqual([
      { key: S1, category: 'match', detail: '' },
      { key: `${S1}/${A1}`, category: 'match', detail: '' },
    ]);
  });

  it('explained: ctx live vs busy/idle/waiting, ctx shell vs busy', () => {
    for (const status of ['busy', 'idle', 'waiting'] as const) {
      const [line] = diffCtx([row(S1, null, { status: 'live' })], [character(S1, null, { status })], none, PROJECT);
      expect(line).toEqual({ key: S1, category: 'explained', detail: `status live→${status}` });
    }
    const [shell] = diffCtx([row(S1, null, { status: 'shell' })], [character(S1, null)], none, PROJECT);
    expect(shell?.category).toBe('explained');
    const [shellIdle] = diffCtx(
      [row(S1, null, { status: 'shell' })],
      [character(S1, null, { status: 'idle' })],
      none,
      PROJECT,
    );
    expect(shellIdle?.category).toBe('mismatch');
  });

  it('explained: ctx ended vs a teammate session and an agent of a teammate session', () => {
    const liveBy = new Map<string, LiveBy>([[S1, 'teammate']]);
    const lines = diffCtx(
      [row(S1, null, { status: 'ended' }), row(S1, A1, { status: 'ended' })],
      [character(S1, null, { status: 'idle' }), character(S1, A1, { status: 'busy' })],
      liveBy,
      PROJECT,
    );
    expect(lines.map((l) => l.category)).toEqual(['explained', 'explained']);
    expect(lines[1]?.detail).toBe('status ended→busy');
    // live by the registry: ended in ctx is not explained
    const registry = new Map<string, LiveBy>([[S1, 'registry']]);
    const [hard] = diffCtx([row(S1, A1, { status: 'ended' })], [character(S1, A1)], registry, PROJECT);
    expect(hard).toEqual({ key: `${S1}/${A1}`, category: 'mismatch', detail: 'status ended→busy' });
  });

  it('mismatch: tokens or verdict differ, even when the status difference is explained', () => {
    const lines = diffCtx(
      [row(S1, null, { tokens: 1200 }), row(S2, null, { status: 'live', verdict: 'WARN' })],
      [character(S1, null), character(S2, null)],
      none,
      PROJECT,
    );
    const byKey = new Map(lines.map((l) => [l.key, l]));
    expect(byKey.get(S1)).toEqual({ key: S1, category: 'mismatch', detail: 'tokens 1200→1000' });
    expect(byKey.get(S2)).toEqual({
      key: S2,
      category: 'mismatch',
      detail: 'verdict WARN→OK, status live→busy (explained)',
    });
  });

  it('only-ctx and only-reader', () => {
    const lines = diffCtx([row(S1, null, { status: 'ended' })], [character(S2, null)], none, PROJECT);
    const byKey = new Map(lines.map((l) => [l.key, l]));
    expect(byKey.get(S1)).toEqual({ key: S1, category: 'only-ctx', detail: 'session ended' });
    expect(byKey.get(S2)).toEqual({ key: S2, category: 'only-reader', detail: 'session busy' });
  });

  it('ignores characters of other projects', () => {
    const lines = diffCtx(
      [row(S1, null)],
      [character(S1, null, { projectId: '/synthetic/other' }), character(S2, null, { projectId: '/synthetic/other' })],
      none,
      PROJECT,
    );
    expect(lines).toEqual([{ key: S1, category: 'only-ctx', detail: 'session busy' }]);
  });
});

describe('summary', () => {
  it('counts every category in a fixed order', () => {
    const lines = diffCtx(
      [row(S1, null), row(S1, A1, { status: 'live' }), row(S2, null, { tokens: 1 })],
      [character(S1, null), character(S1, A1), character(S2, null), character(S2, A1)],
      none,
      PROJECT,
    );
    expect(summary(lines)).toBe('1 match, 1 explained, 1 mismatch, 0 only-ctx, 1 only-reader');
  });
});
