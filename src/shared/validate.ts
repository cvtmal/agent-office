// Hand-written guard for the API contract (no schema library). Each error is
// `<path>: <problem>`, for example `characters[3].status: expected one of busy|idle|...`.
// Unknown extra fields are allowed, so later cycles can add optional fields.

import {
  ACTIVITIES_PER_CHARACTER,
  ACTIVITY_KINDS,
  CHARACTER_KINDS,
  LANE_LETTERS,
  ROLES,
  SNAPSHOT_VERSION,
  STATUSES,
  VERDICTS,
} from './constants.js';
import type { ServerEventType, Snapshot } from './types.js';

const ISO_UTC = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d+)?Z$/;

const EVENT_TYPES: readonly ServerEventType[] = ['snapshot', 'character', 'activity', 'project'];

type Obj = Record<string, unknown>;

function isObj(x: unknown): x is Obj {
  return typeof x === 'object' && x !== null && !Array.isArray(x);
}

function at(base: string, key: string | number): string {
  if (typeof key === 'number') return `${base}[${key}]`;
  return base === '' ? key : `${base}.${key}`;
}

/** Collects errors while walking one value. */
class Checker {
  readonly errors: string[] = [];

  fail(path: string, problem: string): void {
    this.errors.push(`${path === '' ? '(root)' : path}: ${problem}`);
  }

  object(x: unknown, path: string): x is Obj {
    if (isObj(x)) return true;
    this.fail(path, 'expected object');
    return false;
  }

  array(o: Obj, key: string, path: string): unknown[] {
    const v = o[key];
    if (Array.isArray(v)) return v;
    this.fail(at(path, key), 'expected array');
    return [];
  }

  string(o: Obj, key: string, path: string, nullable = false): void {
    const v = o[key];
    if (typeof v === 'string' || (nullable && v === null)) return;
    this.fail(at(path, key), nullable ? 'expected string or null' : 'expected string');
  }

  number(o: Obj, key: string, path: string, nullable = false): void {
    const v = o[key];
    if ((typeof v === 'number' && Number.isFinite(v)) || (nullable && v === null)) return;
    this.fail(at(path, key), nullable ? 'expected number or null' : 'expected number');
  }

  count(o: Obj, key: string, path: string): void {
    const v = o[key];
    if (typeof v === 'number' && Number.isInteger(v) && v >= 0) return;
    this.fail(at(path, key), 'expected integer >= 0');
  }

  boolean(o: Obj, key: string, path: string): void {
    if (typeof o[key] === 'boolean') return;
    this.fail(at(path, key), 'expected boolean');
  }

  time(o: Obj, key: string, path: string, nullable = false): void {
    const v = o[key];
    if ((typeof v === 'string' && ISO_UTC.test(v)) || (nullable && v === null)) return;
    this.fail(at(path, key), nullable ? 'expected ISO UTC time or null' : 'expected ISO UTC time');
  }

  oneOf(o: Obj, key: string, path: string, values: readonly string[]): void {
    const v = o[key];
    if (typeof v === 'string' && values.includes(v)) return;
    this.fail(at(path, key), `expected one of ${values.join('|')}`);
  }

  // --- shapes -------------------------------------------------------------

  laneRef(x: unknown, path: string): x is Obj {
    if (!this.object(x, path)) return false;
    this.string(x, 'slug', path);
    this.oneOf(x, 'letter', path, LANE_LETTERS);
    this.count(x, 'port', path);
    return true;
  }

  lane(x: unknown, path: string): void {
    if (this.laneRef(x, path)) this.string(x, 'worktree', path);
  }

  harness(x: unknown, path: string): void {
    if (x === null) return;
    if (!isObj(x)) {
      this.fail(path, 'expected object or null');
      return;
    }
    this.array(x, 'lanes', path).forEach((lane, i) => this.lane(lane, at(at(path, 'lanes'), i)));
    this.number(x, 'ctoGeneration', path, true);
    this.string(x, 'phase', path, true);
    this.string(x, 'wave', path, true);
    this.array(x, 'outcomes', path).forEach((outcome, i) => {
      const p = at(at(path, 'outcomes'), i);
      if (!this.object(outcome, p)) return;
      this.number(outcome, 'nn', p);
      this.string(outcome, 'slug', p);
    });
    const commit = x['lastCommit'];
    const p = at(path, 'lastCommit');
    if (commit === null) return;
    if (!isObj(commit)) {
      this.fail(p, 'expected object or null');
      return;
    }
    this.string(commit, 'sha', p);
    this.string(commit, 'subject', p);
    this.time(commit, 'at', p);
  }

  health(x: unknown, path: string): void {
    if (!this.object(x, path)) return;
    this.count(x, 'lines', path);
    this.count(x, 'failed', path);
    this.boolean(x, 'drift', path);
    this.string(x, 'version', path, true);
  }

  project(x: unknown, path: string): x is Obj {
    if (!this.object(x, path)) return false;
    this.string(x, 'id', path);
    this.string(x, 'name', path);
    this.string(x, 'displayPath', path);
    this.harness(x['harness'], at(path, 'harness'));
    this.health(x['health'], at(path, 'health'));
    return true;
  }

  character(x: unknown, path: string): x is Obj {
    if (!this.object(x, path)) return false;
    this.string(x, 'id', path);
    this.string(x, 'sessionId', path);
    this.string(x, 'agentId', path, true);
    this.string(x, 'parentId', path, true);
    this.string(x, 'projectId', path);
    this.oneOf(x, 'kind', path, CHARACTER_KINDS);
    this.oneOf(x, 'role', path, ROLES);
    this.string(x, 'name', path);
    this.oneOf(x, 'status', path, STATUSES);
    this.count(x, 'tokens', path);
    this.oneOf(x, 'verdict', path, VERDICTS);
    this.string(x, 'cwd', path, true);
    this.string(x, 'where', path);
    this.string(x, 'gitBranch', path, true);
    this.string(x, 'agentType', path, true);
    this.string(x, 'teamName', path, true);
    if (x['lane'] !== null) {
      if (isObj(x['lane'])) this.laneRef(x['lane'], at(path, 'lane'));
      else this.fail(at(path, 'lane'), 'expected object or null');
    }
    this.time(x, 'lastActivityAt', path, true);
    this.time(x, 'lastUsageAt', path, true);
    this.identity(x, path);
    return true;
  }

  /** Session ids and agent ids must agree with `id` and `kind`. */
  identity(x: Obj, path: string): void {
    const { id, sessionId, agentId, kind } = x;
    if (kind === 'agent') {
      if (agentId === null) this.fail(at(path, 'agentId'), 'expected string for an agent');
      else if (typeof sessionId === 'string' && typeof agentId === 'string' && id !== `${sessionId}/${agentId}`) {
        this.fail(at(path, 'id'), 'expected sessionId/agentId for an agent');
      }
    } else if (kind === 'session') {
      if (agentId !== null) this.fail(at(path, 'agentId'), 'expected null for a session');
      if (id !== sessionId) this.fail(at(path, 'id'), 'expected sessionId for a session');
    }
  }

  activity(x: unknown, path: string): x is Obj {
    if (!this.object(x, path)) return false;
    this.string(x, 'characterId', path);
    this.time(x, 'at', path);
    this.string(x, 'tool', path);
    this.oneOf(x, 'kind', path, ACTIVITY_KINDS);
    this.string(x, 'target', path);
    return true;
  }

  snapshot(x: unknown, path: string): void {
    if (!this.object(x, path)) return;
    if (x['version'] !== SNAPSHOT_VERSION) this.fail(at(path, 'version'), `expected ${SNAPSHOT_VERSION}`);
    this.time(x, 'generatedAt', path);

    const projectIds = new Set<unknown>();
    this.array(x, 'projects', path).forEach((project, i) => {
      const p = at(at(path, 'projects'), i);
      if (!this.project(project, p)) return;
      if (projectIds.has(project['id'])) this.fail(at(p, 'id'), 'duplicate id');
      projectIds.add(project['id']);
    });

    const characters = this.array(x, 'characters', path);
    const characterIds = new Set<unknown>();
    characters.forEach((character, i) => {
      const p = at(at(path, 'characters'), i);
      if (!this.character(character, p)) return;
      if (characterIds.has(character['id'])) this.fail(at(p, 'id'), 'duplicate id');
      characterIds.add(character['id']);
    });
    characters.forEach((character, i) => {
      if (!isObj(character)) return;
      const p = at(at(path, 'characters'), i);
      if (!projectIds.has(character['projectId'])) this.fail(at(p, 'projectId'), 'unknown project');
      const parent = character['parentId'];
      if (parent !== null && !characterIds.has(parent)) this.fail(at(p, 'parentId'), 'unknown character');
    });

    const perCharacter = new Map<unknown, number>();
    this.array(x, 'activities', path).forEach((activity, i) => {
      const p = at(at(path, 'activities'), i);
      if (!this.activity(activity, p)) return;
      const owner = activity['characterId'];
      if (!characterIds.has(owner)) this.fail(at(p, 'characterId'), 'unknown character');
      const n = (perCharacter.get(owner) ?? 0) + 1;
      perCharacter.set(owner, n);
      if (n === ACTIVITIES_PER_CHARACTER + 1) {
        this.fail(at(p, 'characterId'), `more than ${ACTIVITIES_PER_CHARACTER} activities for one character`);
      }
    });
  }
}

/** Every problem of `x` as a Snapshot; empty when it is valid. */
export function validateSnapshot(x: unknown): string[] {
  const checker = new Checker();
  checker.snapshot(x, '');
  return checker.errors;
}

/** True when `x` is a valid Snapshot. */
export function isSnapshot(x: unknown): x is Snapshot {
  return validateSnapshot(x).length === 0;
}

/** Every problem of `x` as a ServerEvent; empty when it is valid. */
export function validateEvent(x: unknown): string[] {
  const checker = new Checker();
  if (!checker.object(x, '')) return checker.errors;
  const type = x['type'];
  const data = x['data'];
  switch (type) {
    case 'snapshot':
      checker.snapshot(data, 'data');
      break;
    case 'character':
      checker.character(data, 'data');
      break;
    case 'activity':
      checker.activity(data, 'data');
      break;
    case 'project':
      checker.project(data, 'data');
      break;
    default:
      checker.fail('type', `expected one of ${EVENT_TYPES.join('|')}`);
  }
  return checker.errors;
}
