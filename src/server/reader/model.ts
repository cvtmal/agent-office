/**
 * The snapshot model: `Discovered` → `Snapshot` (scope DATA-1, research §Selected Approach, D1–D8;
 * planning decision P7). Pure: no file or process access; `rootOf` is injected.
 */
import { basename } from 'node:path';
import { SNAPSHOT_VERSION, type CharacterKind } from '../../shared/constants.js';
import type { Activity, Character, Project, Snapshot } from '../../shared/types.js';
import { roleFor, verdictFor, type Thresholds } from '../../shared/verdict.js';
import { displayPath, whereIn } from '../discovery/repo-root.js';
import type { Discovered, RawSession, RegistryEntry, TeammateProc } from '../discovery/types.js';
import { activitiesOf, lastActivities } from './activity.js';
import { mergeHealth, transcriptHealth, type TranscriptHealth } from './health.js';
import { agentDisplayName, sessionName } from './names.js';
import { mainRecords, parseTranscript, type FileKind, type ParsedTranscript, type Rec } from './records.js';
import { agentStatus, sessionStatus, type LiveBy } from './status.js';
import { lastUsage, type LastUsage } from './tokens.js';

export type { LiveBy } from './status.js';

export interface ModelOptions {
  now: Date;
  home: string;
  thresholds: Thresholds;
  /** Repository root of a cwd (worktrees → parent repo); injected so the reader does no IO. */
  rootOf: (cwd: string) => string;
}

/** A kept character with what the project step needs. */
interface Built {
  character: Character;
  activities: Activity[];
  health: TranscriptHealth;
}

/** The value of the newest record (last in file order) for which `pick` gives non-null. */
function newestOf<T>(records: Rec[], pick: (rec: Rec) => T | null): T | null {
  for (let i = records.length - 1; i >= 0; i--) {
    const rec = records[i];
    const value = rec === undefined ? null : pick(rec);
    if (value !== null) {
      return value;
    }
  }
  return null;
}

/** `agentName`/`teamName` of the newest main record carrying both. */
function teamPair(records: Rec[]): TeammateProc | null {
  return newestOf(mainRecords(records, 'session'), (rec) =>
    rec.agentName !== null && rec.teamName !== null ? { agentName: rec.agentName, teamName: rec.teamName } : null,
  );
}

/**
 * Why each session is live (D3): `registry` for every registry entry; else `teammate` for the newest-mtime
 * session transcript whose team pair equals a running teammate process.
 */
function liveness(
  sessions: RawSession[],
  parsed: Map<RawSession, ParsedTranscript>,
  registry: Map<string, RegistryEntry>,
  teammates: TeammateProc[],
): Map<string, LiveBy> {
  const liveBy = new Map<string, LiveBy>();
  for (const sessionId of registry.keys()) {
    liveBy.set(sessionId, 'registry');
  }
  const pairs = new Map<RawSession, TeammateProc>();
  for (const session of sessions) {
    const pair = teamPair(parsed.get(session)?.records ?? []);
    if (pair !== null) {
      pairs.set(session, pair);
    }
  }
  for (const proc of teammates) {
    let newest: RawSession | null = null;
    for (const [session, pair] of pairs) {
      if (
        pair.agentName === proc.agentName &&
        pair.teamName === proc.teamName &&
        (newest === null || session.mtimeMs > newest.mtimeMs)
      ) {
        newest = session;
      }
    }
    if (newest !== null && !liveBy.has(newest.sessionId)) {
      liveBy.set(newest.sessionId, 'teammate');
    }
  }
  return liveBy;
}

interface CharacterInput {
  id: string;
  sessionId: string;
  agentId: string | null;
  parentId: string | null;
  kind: CharacterKind;
  name: string;
  status: Character['status'];
  cwd: string;
  usage: LastUsage | null;
  agentType: string | null;
  parsed: ParsedTranscript;
}

/** The fields every character derives the same way (step 6.1.4). */
function finish(input: CharacterInput, opts: ModelOptions): Built {
  const fileKind: FileKind = input.kind;
  const main = mainRecords(input.parsed.records, fileKind);
  const role = roleFor(input.kind, input.name);
  const tokens = input.usage?.tokens ?? 0;
  const projectId = opts.rootOf(input.cwd);
  const activities = activitiesOf(input.parsed.records, fileKind, input.id);
  const character: Character = {
    id: input.id,
    sessionId: input.sessionId,
    agentId: input.agentId,
    parentId: input.parentId,
    projectId,
    kind: input.kind,
    role,
    name: input.name,
    status: input.status,
    tokens,
    verdict: verdictFor(tokens, role, opts.thresholds),
    cwd: input.cwd,
    where: whereIn(projectId, input.cwd),
    gitBranch: newestOf(main, (rec) => rec.gitBranch),
    agentType: input.agentType,
    teamName: newestOf(main, (rec) => rec.teamName),
    lane: null,
    lastActivityAt: activities.at(-1)?.at ?? null,
    lastUsageAt: input.usage?.at ?? null,
  };
  return { character, activities: lastActivities(activities), health: transcriptHealth(input.parsed) };
}

function byId<T extends { id: string }>(a: T, b: T): number {
  return a.id < b.id ? -1 : a.id > b.id ? 1 : 0;
}

/** The snapshot of one scan, plus why each live session is live (keyed by session id). */
export function buildModel(input: Discovered, opts: ModelOptions): { snapshot: Snapshot; liveBy: Map<string, LiveBy> } {
  const parsed = new Map<RawSession, ParsedTranscript>(input.sessions.map((s) => [s, parseTranscript(s.text)]));
  const liveBy = liveness(input.sessions, parsed, input.registry, input.teammates);

  const built: Built[] = [];
  const sessionCwd = new Map<string, string>();
  for (const session of input.sessions) {
    const p = parsed.get(session) ?? parseTranscript(session.text);
    const live = liveBy.get(session.sessionId) ?? null;
    const usage = lastUsage(p.records, 'session');
    if (usage === null && live === null) {
      continue;
    }
    const entry = input.registry.get(session.sessionId) ?? null;
    const cwd = usage?.cwd ?? entry?.cwd ?? null;
    if (cwd === null) {
      continue; // P7: cannot be placed in a project
    }
    sessionCwd.set(session.sessionId, cwd);
    built.push(
      finish(
        {
          id: session.sessionId,
          sessionId: session.sessionId,
          agentId: null,
          parentId: null,
          kind: 'session',
          name: sessionName(session.sessionId, entry?.name ?? null, session.customTitle, p.records),
          status: sessionStatus(live, entry, p.records),
          cwd,
          usage,
          agentType: null,
          parsed: p,
        },
        opts,
      ),
    );
  }

  for (const agent of input.agents) {
    const p = parseTranscript(agent.text);
    const usage = lastUsage(p.records, 'agent');
    if (usage === null) {
      continue;
    }
    const parentCwd = sessionCwd.get(agent.sessionId) ?? null;
    const cwd = usage.cwd ?? parentCwd;
    if (cwd === null) {
      continue; // P7
    }
    built.push(
      finish(
        {
          id: `${agent.sessionId}/${agent.agentId}`,
          sessionId: agent.sessionId,
          agentId: agent.agentId,
          parentId: sessionCwd.has(agent.sessionId) ? agent.sessionId : null,
          kind: 'agent',
          name: agentDisplayName(agent.agentId, agent.meta, p.records),
          status: agentStatus(liveBy.has(agent.sessionId), agent.meta),
          cwd,
          usage,
          agentType: agent.meta?.agentType ?? null,
          parsed: p,
        },
        opts,
      ),
    );
  }

  const healthOf = new Map<string, TranscriptHealth[]>();
  for (const b of built) {
    const list = healthOf.get(b.character.projectId) ?? [];
    list.push(b.health);
    healthOf.set(b.character.projectId, list);
  }
  const projects: Project[] = [...healthOf].map(([root, list]) => ({
    id: root,
    name: basename(root) || root,
    displayPath: displayPath(root, opts.home),
    harness: null,
    health: mergeHealth(list),
  }));

  const activities = built
    .flatMap((b) => b.activities)
    .sort((a, b) =>
      a.at < b.at ? -1 : a.at > b.at ? 1 : a.characterId < b.characterId ? -1 : a.characterId > b.characterId ? 1 : 0,
    );

  return {
    snapshot: {
      version: SNAPSHOT_VERSION,
      generatedAt: opts.now.toISOString(),
      projects: projects.sort(byId),
      characters: built.map((b) => b.character).sort(byId),
      activities,
    },
    liveBy,
  };
}

/** `buildModel(...).snapshot`. */
export function buildSnapshot(input: Discovered, opts: ModelOptions): Snapshot {
  return buildModel(input, opts).snapshot;
}
