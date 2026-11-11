// The API contract between server and client (scope DATA-7, docs/rpi-cycles.md S3).
// Hotspot rule: later cycles add optional fields only; nothing is renamed or removed.
// All times are ISO 8601 UTC strings (`2026-11-11T09:00:00Z`).

import type { ActivityKind, CharacterKind, LaneLetter, Role, Status, Verdict } from './constants.js';

/** Everything the client needs to draw the office at one moment. */
export interface Snapshot {
  /** Shape version; equals SNAPSHOT_VERSION. */
  version: number;
  /** When the server built this snapshot. */
  generatedAt: string;
  /** Projects that have at least one character. */
  projects: Project[];
  /** Sessions and agents, alive or recently ended. */
  characters: Character[];
  /** Most recent activities, at most ACTIVITIES_PER_CHARACTER per character. */
  activities: Activity[];
}

/** One repository the agents work in. */
export interface Project {
  /** Absolute path of the repository root. */
  id: string;
  /** Short name (the root folder's basename). */
  name: string;
  /** Root path relative to the home folder (`~/code/x`). */
  displayPath: string;
  /** Harness state when the project runs the agent harness, else null. */
  harness: HarnessExtras | null;
  /** How well the transcript format of this project's sessions is understood. */
  health: FormatHealth;
}

/** A session or agent drawn as one character. */
export interface Character {
  /** Session id for a session; `sessionId/agentId` for an agent. */
  id: string;
  /** Session the character belongs to (its own id for a session). */
  sessionId: string;
  /** Agent id inside the session; null for a session. */
  agentId: string | null;
  /** Id of the character that spawned this one; null for a top-level session. */
  parentId: string | null;
  /** Id of the project the character works in. */
  projectId: string;
  /** Session or agent. */
  kind: CharacterKind;
  /** CTO or teammate; decides the thresholds. */
  role: Role;
  /** Display name (session title or agent name). */
  name: string;
  /** Current status. */
  status: Status;
  /** Context tokens in use at the last usage record. */
  tokens: number;
  /** Verdict for `tokens` under the role's thresholds. */
  verdict: Verdict;
  /** Absolute working directory, or null when unknown. */
  cwd: string | null;
  /** Working directory relative to the project root (`.` for the main checkout). */
  where: string;
  /** Git branch at the last record, or null. */
  gitBranch: string | null;
  /** Agent type (`Explore`, `general-purpose`, ...) for agents, else null. */
  agentType: string | null;
  /** Team name when the session belongs to a team, else null. */
  teamName: string | null;
  /** The harness lane the character works in, or null. */
  lane: LaneRef | null;
  /** Time of the last activity, or null. */
  lastActivityAt: string | null;
  /** Time of the last usage record, or null. */
  lastUsageAt: string | null;
}

/** A reference to a harness lane. */
export interface LaneRef {
  /** Cycle slug of the lane. */
  slug: string;
  /** Lane letter. */
  letter: LaneLetter;
  /** Port reserved for the lane. */
  port: number;
}

/** A harness lane with its worktree. */
export interface Lane extends LaneRef {
  /** Worktree path relative to the project root. */
  worktree: string;
}

/** One tool call, privacy-shaped. */
export interface Activity {
  /** Id of the character that made the call. */
  characterId: string;
  /** When the call was made. */
  at: string;
  /** Tool name as Claude Code records it. */
  tool: string;
  /** Kind derived from `tool` (toolKind). */
  kind: ActivityKind;
  /** Short target: file basename, first word of a command, host, agent or skill name. */
  target: string;
}

/** Harness state of a project. */
export interface HarnessExtras {
  /** Open lanes. */
  lanes: Lane[];
  /** Generation number of the current CTO, or null. */
  ctoGeneration: number | null;
  /** Phase of the running cycle, or null. */
  phase: string | null;
  /** Current wave, or null. */
  wave: string | null;
  /** Finished cycles (docs/outcomes). */
  outcomes: Outcome[];
  /** Last commit on main, or null. */
  lastCommit: CommitRef | null;
}

/** A finished cycle. */
export interface Outcome {
  /** Cycle number. */
  nn: number;
  /** Cycle slug. */
  slug: string;
}

/** A commit. */
export interface CommitRef {
  /** Full commit sha. */
  sha: string;
  /** First line of the message. */
  subject: string;
  /** Commit time. */
  at: string;
}

/** Transcript-format health of a project. */
export interface FormatHealth {
  /** Lines read. */
  lines: number;
  /** Lines that could not be parsed. */
  failed: number;
  /** True when the failure ratio exceeds DRIFT_RATIO. */
  drift: boolean;
  /** Claude Code version seen last, or null. */
  version: string | null;
}

/** A message on the server's event stream. */
export type ServerEvent =
  | { type: 'snapshot'; data: Snapshot }
  | { type: 'character'; data: Character }
  | { type: 'activity'; data: Activity }
  | { type: 'project'; data: Project };

/** The `type` of a ServerEvent. */
export type ServerEventType = ServerEvent['type'];
