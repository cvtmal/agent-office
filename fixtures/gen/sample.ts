// Builds fixtures/snapshots/sample.json: 14 synthetic characters in two projects
// that together cover every status, activity kind and verdict (docs/rpi-cycles.md § 0).
// Deterministic: no clock, no randomness. Run with `make fixtures`.

import { writeFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';
import { SNAPSHOT_VERSION, type CharacterKind, type LaneLetter, type Status } from '../../src/shared/constants.js';
import { toolKind } from '../../src/shared/tools.js';
import type { Activity, Character, Lane, Project, Snapshot } from '../../src/shared/types.js';
import { roleFor, verdictFor } from '../../src/shared/verdict.js';

const GENERATED_AT_MS = Date.UTC(2026, 10, 11, 9, 0, 0);

/** ISO UTC time `minutes` before generatedAt, without milliseconds. */
function before(minutes: number): string {
  return new Date(GENERATED_AT_MS - minutes * 60_000).toISOString().replace('.000Z', 'Z');
}

/** 32-bit FNV-1a of a string, as 8 hex digits. */
function fnv1a(text: string): string {
  let hash = 0x811c9dc5;
  for (const byte of new TextEncoder().encode(text)) {
    hash ^= byte;
    hash = Math.imul(hash, 0x01000193) >>> 0;
  }
  return hash.toString(16).padStart(8, '0');
}

/** `length` hex digits derived from a seed. */
function hex(seed: string, length: number): string {
  let out = '';
  for (let i = 0; out.length < length; i++) out += fnv1a(`${seed}:${i}`);
  return out.slice(0, length);
}

/** A UUID-shaped id (version nibble 4) derived from a seed. */
export function syntheticUuid(seed: string): string {
  const h = hex(seed, 32);
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-4${h.slice(13, 16)}-${h.slice(16, 20)}-${h.slice(20, 32)}`;
}

const HARBOR = '/home/demo/code/harbor';
const NOTES = '/home/demo/code/notes-app';

const LANES: Lane[] = (
  [
    ['A', 'live-updates'],
    ['B', 'inspector'],
    ['C', 'project-overview'],
    ['D', 'replay-mode'],
  ] as const
).map(([letter, slug], i) => ({ slug, letter, port: 8001 + i, worktree: `.claude/worktrees/${slug}` }));

function projects(): Project[] {
  return [
    {
      id: HARBOR,
      name: 'harbor',
      displayPath: '~/code/harbor',
      harness: {
        lanes: LANES,
        ctoGeneration: 2,
        phase: 'implement',
        wave: 'W2',
        outcomes: [
          { nn: 0, slug: 'bootstrap' },
          { nn: 1, slug: 'transcript-reader' },
          { nn: 2, slug: 'office-scene' },
        ],
        lastCommit: {
          sha: hex('commit:office-scene', 40),
          subject: 'office-scene: the office room and characters',
          at: before(45),
        },
      },
      health: { lines: 4210, failed: 3, drift: false, version: '2.9.0' },
    },
    {
      id: NOTES,
      name: 'notes-app',
      displayPath: '~/code/notes-app',
      harness: null,
      health: { lines: 500, failed: 40, drift: true, version: '2.8.4' },
    },
  ];
}

/** One row of the character table; activities are [minutes before, tool, target]. */
interface Spec {
  name: string;
  project: string;
  kind: CharacterKind;
  status: Status;
  tokens: number;
  lane?: LaneLetter;
  parent?: string;
  agentType?: string;
  teamName?: string;
  /** Minutes before generatedAt of the last activity, for characters without activities. */
  lastSeen?: number;
  activities?: [number, string, string][];
}

const SPECS: Spec[] = [
  {
    name: 'cto-2',
    project: HARBOR,
    kind: 'session',
    status: 'busy',
    tokens: 252_000,
    teamName: 'harbor',
    activities: [
      [20, 'Agent', 'c06-review'],
      [12, 'Read', 'STATE.md'],
      [3, 'Bash', 'git'],
      [1, 'Edit', 'DECISIONS.md'],
    ],
  },
  {
    name: 'c03-implement',
    project: HARBOR,
    kind: 'session',
    status: 'busy',
    tokens: 120_000,
    lane: 'A',
    teamName: 'harbor',
    activities: [
      [9, 'Read', 'store.ts'],
      [8, 'Agent', 'explore-imports'],
      [6, 'Edit', 'store.ts'],
      [2, 'Bash', 'make'],
    ],
  },
  {
    name: 'c04-research',
    project: HARBOR,
    kind: 'session',
    status: 'idle',
    tokens: 160_000,
    lane: 'B',
    teamName: 'harbor',
    activities: [
      [30, 'WebFetch', 'vite.dev'],
      [28, 'Read', 'scope.md'],
      [25, 'Skill', 'rpi-research'],
    ],
  },
  {
    name: 'c05-plan',
    project: HARBOR,
    kind: 'session',
    status: 'waiting',
    tokens: 90_000,
    lane: 'C',
    teamName: 'harbor',
    activities: [
      [10, 'TodoWrite', 'todos'],
      [4, 'AskUserQuestion', 'question'],
    ],
  },
  {
    name: 'c06-review',
    project: HARBOR,
    kind: 'session',
    status: 'busy',
    tokens: 185_000,
    lane: 'D',
    teamName: 'harbor',
    activities: [
      [15, 'Agent', 'check-tests'],
      [7, 'Grep', 'routes.ts'],
      [1, 'Bash', 'npx'],
    ],
  },
  {
    name: 'explore-imports',
    project: HARBOR,
    kind: 'agent',
    parent: 'c03-implement',
    agentType: 'Explore',
    status: 'busy',
    tokens: 40_000,
    activities: [
      [7, 'Glob', 'src'],
      [5, 'Read', 'main.ts'],
    ],
  },
  {
    name: 'check-tests',
    project: HARBOR,
    kind: 'agent',
    parent: 'c06-review',
    agentType: 'general-purpose',
    status: 'stopped',
    tokens: 30_000,
    activities: [
      [14, 'Bash', 'make'],
      [13, 'Read', 'sample.test.ts'],
    ],
  },
  {
    name: 'owner-docs',
    project: HARBOR,
    kind: 'session',
    status: 'idle',
    tokens: 60_000,
    activities: [
      [40, 'Edit', 'README.md'],
      [35, 'mcp__claude-in-chrome__navigate', 'localhost'],
    ],
  },
  { name: 'quick-fix', project: HARBOR, kind: 'session', status: 'ended', tokens: 12_000, lastSeen: 180 },
  {
    name: 'notes-search',
    project: NOTES,
    kind: 'session',
    status: 'busy',
    tokens: 100_000,
    activities: [
      [5, 'Agent', 'find-index'],
      [3, 'Read', 'search.ts'],
      [1, 'mcp__playwright__browser_navigate', 'localhost'],
    ],
  },
  {
    name: 'notes-ui',
    project: NOTES,
    kind: 'session',
    status: 'idle',
    tokens: 155_000,
    activities: [
      [50, 'Write', 'Button.tsx'],
      [45, 'Bash', 'npm'],
    ],
  },
  { name: 'notes-migrate', project: NOTES, kind: 'session', status: 'ended', tokens: 70_000, lastSeen: 240 },
  {
    name: 'find-index',
    project: NOTES,
    kind: 'agent',
    parent: 'notes-search',
    agentType: 'Explore',
    status: 'idle',
    tokens: 20_000,
    activities: [[4, 'Grep', 'index.ts']],
  },
  {
    name: 'rename-files',
    project: NOTES,
    kind: 'agent',
    parent: 'notes-migrate',
    agentType: 'general-purpose',
    status: 'ended',
    tokens: 25_000,
    lastSeen: 250,
  },
];

/** The sample snapshot (same value on every call). */
export function buildSample(): Snapshot {
  const characters: Character[] = [];
  const activities: Activity[] = [];
  const byName = new Map<string, Character>();

  for (const spec of SPECS) {
    const parent = spec.parent === undefined ? undefined : byName.get(spec.parent);
    if (spec.parent !== undefined && parent === undefined) throw new Error(`parent ${spec.parent} must come first`);
    const lane = spec.lane === undefined ? undefined : LANES.find((l) => l.letter === spec.lane);

    const sessionId = parent?.sessionId ?? syntheticUuid(`session:${spec.name}`);
    const agentId = spec.kind === 'agent' ? `a${hex(`agent:${spec.name}`, 16)}` : null;
    const where = parent?.where ?? (lane ? lane.worktree : '.');
    const role = roleFor(spec.kind, spec.name);
    const own = (spec.activities ?? []).map(([minutes, tool, target]) => ({ at: before(minutes), tool, target }));
    const last = own.length > 0 ? own[own.length - 1]?.at : undefined;
    const lastActivityAt = last ?? before(spec.lastSeen ?? 0);

    const character: Character = {
      id: agentId === null ? sessionId : `${sessionId}/${agentId}`,
      sessionId,
      agentId,
      parentId: parent?.id ?? null,
      projectId: spec.project,
      kind: spec.kind,
      role,
      name: spec.name,
      status: spec.status,
      tokens: spec.tokens,
      verdict: verdictFor(spec.tokens, role),
      cwd: where === '.' ? spec.project : `${spec.project}/${where}`,
      where,
      gitBranch: parent?.gitBranch ?? (lane ? lane.slug : 'main'),
      agentType: spec.agentType ?? null,
      teamName: spec.teamName ?? null,
      lane: parent?.lane ?? (lane ? { slug: lane.slug, letter: lane.letter, port: lane.port } : null),
      lastActivityAt,
      lastUsageAt: lastActivityAt,
    };
    characters.push(character);
    byName.set(spec.name, character);
    for (const a of own) {
      activities.push({ characterId: character.id, at: a.at, tool: a.tool, kind: toolKind(a.tool), target: a.target });
    }
  }

  activities.sort((a, b) => (a.at < b.at ? -1 : a.at > b.at ? 1 : 0));

  return {
    version: SNAPSHOT_VERSION,
    generatedAt: before(0),
    projects: projects(),
    characters,
    activities,
  };
}

const entry = process.argv[1];
if (entry !== undefined && import.meta.url === pathToFileURL(entry).href) {
  const target = new URL('../snapshots/sample.json', import.meta.url);
  writeFileSync(target, JSON.stringify(buildSample(), null, 2) + '\n');
  console.log(`wrote ${target.pathname.split('/').slice(-3).join('/')}`);
}
