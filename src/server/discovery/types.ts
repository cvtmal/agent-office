// The only IO result the reader sees (plan § Contracts); re-exported by index.ts.
import type { ParsedTranscript } from '../reader/records.js';

/** One live entry of `<config>/sessions/*.json`. */
export interface RegistryEntry {
  pid: number;
  sessionId: string;
  procStart: string | null;
  status: string | null;
  updatedAt: number;
  cwd: string | null;
  name: string | null;
}

/** `agent-<id>.meta.json` next to an agent transcript. */
export interface AgentMeta {
  agentType: string | null;
  description: string | null;
  name: string | null;
  finished: boolean;
  stoppedByUser: boolean;
}

export interface RawSession {
  sessionId: string;
  path: string;
  mtimeMs: number;
  text: string;
  /** Pre-parsed (e.g. retained) records; when set, the reader uses it instead of parsing `text`. */
  parsed?: ParsedTranscript;
  customTitle: string | null;
}

export interface RawAgent {
  sessionId: string;
  agentId: string;
  path: string;
  mtimeMs: number;
  text: string;
  /** Pre-parsed (e.g. retained) records; when set, the reader uses it instead of parsing `text`. */
  parsed?: ParsedTranscript;
  meta: AgentMeta | null;
}

/** A running teammate process (`--agent-name X --team-name Y`). */
export interface TeammateProc {
  agentName: string;
  teamName: string;
}

export interface Discovered {
  sessions: RawSession[];
  agents: RawAgent[];
  registry: Map<string, RegistryEntry>;
  teammates: TeammateProc[];
}
