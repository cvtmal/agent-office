/**
 * Transcript records, normalised (research D7, D8). A `Rec` keeps only the fields the reader
 * interprets; it never holds prompt, text, thinking or tool-result content (privacy by construction).
 * Pure: no file or process access.
 */

export type Block =
  | { type: 'tool_use'; name: string; input: Record<string, unknown> }
  | { type: 'tool_result' }
  | { type: 'text' }
  | { type: 'thinking' }
  | { type: 'other' };

/** Token counts of one assistant message; a non-number value counts as 0. */
export interface Usage {
  input: number;
  cacheCreation: number;
  cacheRead: number;
  output: number;
}

export interface Rec {
  /** Record type; `''` if absent or not a string. */
  type: string;
  /** ISO timestamp (`new Date(t).toISOString()`); unparsable → null. */
  timestamp: string | null;
  sessionId: string | null;
  cwd: string | null;
  gitBranch: string | null;
  agentName: string | null;
  teamName: string | null;
  version: string | null;
  subtype: string | null;
  customTitle: string | null;
  aiTitle: string | null;
  /** True only when the record says `isSidechain: true`. */
  isSidechain: boolean;
  /** `message.content`: a string becomes one text block; a non-array becomes `[]`. */
  content: Block[];
  /** `message.usage`; null when absent or not an object. */
  usage: Usage | null;
  /** `message.stop_reason`. */
  stopReason: string | null;
}

export interface ParsedTranscript {
  records: Rec[];
  /** One entry per non-empty line, in order: true when the line parsed to an object. */
  lineOk: boolean[];
}

export type FileKind = 'session' | 'agent';

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function str(value: unknown): string | null {
  return typeof value === 'string' ? value : null;
}

function num(value: unknown): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : 0;
}

function timestampOf(value: unknown): string | null {
  if (typeof value !== 'string') {
    return null;
  }
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

function blockOf(value: unknown): Block {
  if (!isObject(value)) {
    return { type: 'other' };
  }
  switch (value.type) {
    case 'tool_use':
      return {
        type: 'tool_use',
        name: typeof value.name === 'string' ? value.name : '',
        input: isObject(value.input) ? value.input : {},
      };
    case 'tool_result':
      return { type: 'tool_result' };
    case 'text':
      return { type: 'text' };
    case 'thinking':
      return { type: 'thinking' };
    default:
      return { type: 'other' };
  }
}

function contentOf(value: unknown): Block[] {
  if (typeof value === 'string') {
    return [{ type: 'text' }];
  }
  return Array.isArray(value) ? value.map(blockOf) : [];
}

function usageOf(value: unknown): Usage | null {
  if (!isObject(value)) {
    return null;
  }
  return {
    input: num(value.input_tokens),
    cacheCreation: num(value.cache_creation_input_tokens),
    cacheRead: num(value.cache_read_input_tokens),
    output: num(value.output_tokens),
  };
}

/** Normalises one parsed line to a `Rec`. Never throws. */
export function normalise(value: unknown): Rec {
  const obj = isObject(value) ? value : {};
  const message = isObject(obj.message) ? obj.message : {};
  return {
    type: str(obj.type) ?? '',
    timestamp: timestampOf(obj.timestamp),
    sessionId: str(obj.sessionId),
    cwd: str(obj.cwd),
    gitBranch: str(obj.gitBranch),
    agentName: str(obj.agentName),
    teamName: str(obj.teamName),
    version: str(obj.version),
    subtype: str(obj.subtype),
    customTitle: str(obj.customTitle),
    aiTitle: str(obj.aiTitle),
    isSidechain: obj.isSidechain === true,
    content: contentOf(message.content),
    usage: usageOf(message.usage),
    stopReason: str(message.stop_reason),
  };
}

/** Parses a JSONL transcript. Empty lines are ignored; a line is ok iff it parses to an object. */
export function parseTranscript(text: string): ParsedTranscript {
  const records: Rec[] = [];
  const lineOk: boolean[] = [];
  for (const line of text.split('\n')) {
    if (line.trim() === '') {
      continue;
    }
    let value: unknown;
    try {
      value = JSON.parse(line);
    } catch {
      lineOk.push(false);
      continue;
    }
    if (!isObject(value)) {
      lineOk.push(false);
      continue;
    }
    lineOk.push(true);
    records.push(normalise(value));
  }
  return { records, lineOk };
}

/** The records of the file's own conversation: a session file drops sidechain records; an agent file keeps all. */
export function mainRecords(records: Rec[], kind: FileKind): Rec[] {
  return kind === 'session' ? records.filter((rec) => !rec.isSidechain) : records;
}
