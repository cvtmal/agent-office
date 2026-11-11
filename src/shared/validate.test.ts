import { describe, expect, it } from 'vitest';
import type { Activity, Character, HarnessExtras, Lane, LaneRef, Project, Snapshot } from './types.js';
import { isSnapshot, validateEvent, validateSnapshot } from './validate.js';

const LANE: Lane = { slug: 'reader', letter: 'A', port: 8001, worktree: '.claude/worktrees/reader' };

const HARNESS: HarnessExtras = {
  lanes: [LANE],
  ctoGeneration: 1,
  phase: 'plan',
  wave: 'W1',
  outcomes: [{ nn: 0, slug: 'bootstrap' }],
  lastCommit: { sha: 'a'.repeat(40), subject: 'bootstrap', at: '2026-11-11T08:00:00Z' },
};

const PROJECT: Project = {
  id: '/home/demo/code/app',
  name: 'app',
  displayPath: '~/code/app',
  harness: HARNESS,
  health: { lines: 10, failed: 0, drift: false, version: '2.9.0' },
};

const SESSION: Character = {
  id: 's1',
  sessionId: 's1',
  agentId: null,
  parentId: null,
  projectId: PROJECT.id,
  kind: 'session',
  role: 'teammate',
  name: 'c01-plan',
  status: 'busy',
  tokens: 1000,
  verdict: 'OK',
  cwd: '/home/demo/code/app/.claude/worktrees/reader',
  where: '.claude/worktrees/reader',
  gitBranch: 'reader',
  agentType: null,
  teamName: null,
  lane: { slug: 'reader', letter: 'A', port: 8001 },
  lastActivityAt: '2026-11-11T08:59:00.123Z',
  lastUsageAt: null,
};

const AGENT: Character = {
  ...SESSION,
  id: 's1/a1',
  agentId: 'a1',
  parentId: 's1',
  kind: 'agent',
  name: 'explore',
  agentType: 'Explore',
  lane: null,
};

const ACTIVITY: Activity = {
  characterId: 's1',
  at: '2026-11-11T08:59:00Z',
  tool: 'Read',
  kind: 'read',
  target: 'store.ts',
};

/** A fresh valid snapshot plus direct handles on its parts, so tests can edit them. */
function parts() {
  const lane = structuredClone(LANE);
  const sessionLane: LaneRef = { slug: lane.slug, letter: lane.letter, port: lane.port };
  const harness: HarnessExtras = { ...structuredClone(HARNESS), lanes: [lane] };
  const project: Project = { ...structuredClone(PROJECT), harness };
  const session: Character = { ...structuredClone(SESSION), lane: sessionLane };
  const agent: Character = structuredClone(AGENT);
  const activity: Activity = structuredClone(ACTIVITY);
  const snapshot: Snapshot = {
    version: 1,
    generatedAt: '2026-11-11T09:00:00Z',
    projects: [project],
    characters: [session, agent],
    activities: [activity],
  };
  return { snapshot, project, lane, session, sessionLane, agent, activity };
}

function sample(): Snapshot {
  return parts().snapshot;
}

/** Errors of the sample after `edit` changed it. */
function errorsAfter(edit: (p: ReturnType<typeof parts>) => void): string[] {
  const p = parts();
  edit(p);
  return validateSnapshot(p.snapshot);
}

describe('validateSnapshot', () => {
  it('accepts a minimal valid snapshot', () => {
    expect(validateSnapshot(sample())).toEqual([]);
  });

  it('accepts unknown extra fields', () => {
    expect(errorsAfter((p) => Object.assign(p.session, { mood: 'happy' }))).toEqual([]);
  });

  it('rejects a non-object', () => {
    expect(validateSnapshot(null)).toEqual(['(root): expected object']);
  });

  it('checks the version', () => {
    expect(errorsAfter((p) => (p.snapshot.version = 2))).toEqual(['version: expected 1']);
  });

  it('checks ISO UTC times', () => {
    expect(errorsAfter((p) => (p.snapshot.generatedAt = '2026-11-11 09:00'))).toEqual([
      'generatedAt: expected ISO UTC time',
    ]);
    expect(errorsAfter((p) => (p.session.lastActivityAt = '2026-11-11T09:00:00+01:00'))).toEqual([
      'characters[0].lastActivityAt: expected ISO UTC time or null',
    ]);
  });

  it('checks arrays', () => {
    expect(errorsAfter((p) => Object.assign(p.snapshot, { activities: {} }))).toEqual(['activities: expected array']);
  });

  it('checks strings and nullability', () => {
    expect(errorsAfter((p) => Object.assign(p.session, { name: null }))).toEqual([
      'characters[0].name: expected string',
    ]);
    expect(errorsAfter((p) => Object.assign(p.session, { gitBranch: 3 }))).toEqual([
      'characters[0].gitBranch: expected string or null',
    ]);
  });

  it('checks the optional activity detail', () => {
    expect(errorsAfter((p) => Object.assign(p.activity, { detail: '{"command":"ls"}' }))).toEqual([]);
    expect(errorsAfter((p) => Object.assign(p.activity, { detail: 42 }))).toEqual(['activities[0].detail: expected string']);
    expect(errorsAfter((p) => Object.assign(p.activity, { detail: null }))).toEqual(['activities[0].detail: expected string']);
  });

  it('checks enum membership', () => {
    expect(errorsAfter((p) => Object.assign(p.agent, { status: 'sleeping' }))).toEqual([
      'characters[1].status: expected one of busy|idle|waiting|stopped|ended',
    ]);
    expect(errorsAfter((p) => Object.assign(p.activity, { kind: 'think' }))).toEqual([
      'activities[0].kind: expected one of read|write|shell|web|delegate|plan|other',
    ]);
    expect(errorsAfter((p) => Object.assign(p.session, { verdict: 'BAD' }))).toEqual([
      'characters[0].verdict: expected one of OK|WARN|RECYCLE|HANDOVER',
    ]);
    expect(errorsAfter((p) => Object.assign(p.sessionLane, { letter: 'E' }))).toEqual([
      'characters[0].lane.letter: expected one of A|B|C|D',
    ]);
  });

  it('checks integers >= 0', () => {
    expect(errorsAfter((p) => (p.session.tokens = -1))).toEqual([
      'characters[0].tokens: expected integer >= 0',
    ]);
    expect(errorsAfter((p) => (p.project.health.failed = 1.5))).toEqual([
      'projects[0].health.failed: expected integer >= 0',
    ]);
    expect(errorsAfter((p) => (p.lane.port = -8001))).toEqual([
      'projects[0].harness.lanes[0].port: expected integer >= 0',
    ]);
  });

  it('checks booleans and nested objects', () => {
    expect(errorsAfter((p) => Object.assign(p.project.health, { drift: 'no' }))).toEqual([
      'projects[0].health.drift: expected boolean',
    ]);
    expect(errorsAfter((p) => Object.assign(p.project, { harness: 'yes' }))).toEqual([
      'projects[0].harness: expected object or null',
    ]);
    expect(errorsAfter((p) => (p.project.harness = null))).toEqual([]);
  });

  it('rejects duplicate ids', () => {
    expect(errorsAfter((p) => p.snapshot.projects.push(structuredClone(PROJECT)))).toEqual(['projects[1].id: duplicate id']);
    expect(errorsAfter((p) => p.snapshot.characters.push(structuredClone(SESSION)))).toEqual([
      'characters[2].id: duplicate id',
    ]);
  });

  it('checks references', () => {
    expect(errorsAfter((p) => (p.session.projectId = '/home/demo/other'))).toEqual([
      'characters[0].projectId: unknown project',
    ]);
    expect(errorsAfter((p) => (p.agent.parentId = 'nobody'))).toEqual([
      'characters[1].parentId: unknown character',
    ]);
    expect(errorsAfter((p) => (p.activity.characterId = 'nobody'))).toEqual([
      'activities[0].characterId: unknown character',
    ]);
  });

  it('checks agent identity', () => {
    expect(errorsAfter((p) => (p.agent.agentId = null))).toEqual([
      'characters[1].agentId: expected string for an agent',
    ]);
    expect(errorsAfter((p) => (p.agent.id = 'a1'))).toEqual([
      'characters[1].id: expected sessionId/agentId for an agent',
    ]);
  });

  it('checks session identity', () => {
    expect(errorsAfter((p) => (p.session.agentId = 'a9'))).toEqual([
      'characters[0].agentId: expected null for a session',
    ]);
    expect(
      errorsAfter((p) => {
        p.session.id = 's2';
        p.agent.parentId = 's2';
        p.activity.characterId = 's2';
      }),
    ).toEqual(['characters[0].id: expected sessionId for a session']);
  });

  it('limits activities per character', () => {
    expect(
      errorsAfter((p) => {
        p.snapshot.activities = Array.from({ length: 11 }, () => structuredClone(ACTIVITY));
      }),
    ).toEqual(['activities[10].characterId: more than 10 activities for one character']);
  });
});

describe('isSnapshot', () => {
  it('narrows a valid value', () => {
    const x: unknown = sample();
    if (!isSnapshot(x)) throw new Error('expected a snapshot');
    expect(x.characters).toHaveLength(2);
  });

  it('rejects an invalid value', () => {
    expect(isSnapshot({ version: 1 })).toBe(false);
  });
});

describe('validateEvent', () => {
  it('accepts each event type', () => {
    expect(validateEvent({ type: 'snapshot', data: sample() })).toEqual([]);
    expect(validateEvent({ type: 'character', data: AGENT })).toEqual([]);
    expect(validateEvent({ type: 'activity', data: ACTIVITY })).toEqual([]);
    expect(validateEvent({ type: 'project', data: PROJECT })).toEqual([]);
  });

  it('rejects an unknown type', () => {
    expect(validateEvent({ type: 'ping', data: {} })).toEqual([
      'type: expected one of snapshot|character|activity|project',
    ]);
  });

  it('reports paths under data', () => {
    expect(validateEvent({ type: 'character', data: { ...SESSION, status: 'gone' } })).toEqual([
      'data.status: expected one of busy|idle|waiting|stopped|ended',
    ]);
  });
});
