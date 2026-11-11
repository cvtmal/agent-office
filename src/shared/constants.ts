// Shared constants of the API contract (docs/rpi-cycles.md S3). Data only.

/** Character status, from most to least alive. */
export const STATUSES = ['busy', 'idle', 'waiting', 'stopped', 'ended'] as const;

/** What a tool call does, as shown on a character's activity line. */
export const ACTIVITY_KINDS = ['read', 'write', 'shell', 'web', 'delegate', 'plan', 'other'] as const;

/** Context-budget verdict, as `bin/harness/ctx` reports it. */
export const VERDICTS = ['OK', 'WARN', 'RECYCLE', 'HANDOVER'] as const;

/** A top-level Claude Code session or a subagent inside one. */
export const CHARACTER_KINDS = ['session', 'agent'] as const;

/** Harness role; decides which thresholds apply. */
export const ROLES = ['cto', 'teammate'] as const;

/** Lane letters of the harness (four parallel lanes). */
export const LANE_LETTERS = ['A', 'B', 'C', 'D'] as const;

/** Token thresholds per role (inclusive: tokens >= limit). */
export const THRESHOLDS = {
  teammate: { warn: 150_000, recycle: 180_000 },
  cto: { warn: 220_000, handover: 250_000 },
} as const;

/** Environment variables that override THRESHOLDS (read by the server). */
export const THRESHOLD_ENV = {
  teammateWarn: 'HARNESS_TEAMMATE_WARN',
  teammateRecycle: 'HARNESS_TEAMMATE_RECYCLE',
  ctoWarn: 'HARNESS_CTO_WARN',
  ctoHandover: 'HARNESS_CTO_HANDOVER',
} as const;

/** A session whose name matches this is the CTO. */
export const CTO_NAME_PATTERN = /^cto/i;

/** Tool name to activity kind (scope DATA-3). Unknown tools are `other`. */
export const TOOL_KIND = {
  Read: 'read',
  Grep: 'read',
  Glob: 'read',
  LSP: 'read',
  Edit: 'write',
  Write: 'write',
  NotebookEdit: 'write',
  Bash: 'shell',
  Monitor: 'shell',
  WebFetch: 'web',
  WebSearch: 'web',
  Agent: 'delegate',
  SendMessage: 'delegate',
  Workflow: 'delegate',
  TodoWrite: 'plan',
  EnterPlanMode: 'plan',
  Skill: 'plan',
} as const satisfies Record<string, ActivityKind>;

/** MCP tool-name prefixes of browser tools; they count as `web`. */
export const BROWSER_TOOL_PREFIXES = ['mcp__claude-in-chrome__', 'mcp__playwright__'] as const;

/** Share of failed lines above which a project's transcript format counts as drifted. */
export const DRIFT_RATIO = 0.05;
/** Number of most recent lines the drift ratio is computed over. */
export const DRIFT_WINDOW_LINES = 500;
/** Most recent activities kept per character. */
export const ACTIVITIES_PER_CHARACTER = 10;
/** Port used when neither --port nor HARNESS_PORT is given. */
export const DEFAULT_PORT = 4477;
/** Sessions older than this are not shown. */
export const MAX_AGE_HOURS = 24;
/** Client poll interval while the event stream is down. */
export const POLL_MS = 2000;
/** Version of the Snapshot shape. */
export const SNAPSHOT_VERSION = 1;
/** Logical scene width in pixels (scaled by an integer factor). */
export const SCENE_WIDTH = 480;
/** Logical scene height in pixels. */
export const SCENE_HEIGHT = 270;

export type Status = (typeof STATUSES)[number];
export type ActivityKind = (typeof ACTIVITY_KINDS)[number];
export type Verdict = (typeof VERDICTS)[number];
export type CharacterKind = (typeof CHARACTER_KINDS)[number];
export type Role = (typeof ROLES)[number];
export type LaneLetter = (typeof LANE_LETTERS)[number];
