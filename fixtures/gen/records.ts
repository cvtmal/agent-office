// Builders for synthetic transcript records shaped like Claude Code's JSONL lines
// (research "Real data": one content block per assistant record, stop_reason on each).
// Deterministic: fixed base time plus offsets, ids from syntheticUuid. Paths only under /home/dev.

import { syntheticUuid } from './sample.js';

/** Fixed base time of every fixture; a player shifts by now − BASE. */
export const BASE = '2026-01-01T00:00:00.000Z';
export const BASE_MS = Date.parse(BASE);

/** ISO time `ms` milliseconds after BASE. */
export function at(ms: number): string {
  return new Date(BASE_MS + ms).toISOString();
}

/** Fake Claude Code versions; never a real one. */
export const VERSION_OLD = '9.9.0';
export const VERSION_NEW = '9.9.1';

/** The n-th fake secret marker (1-based). */
export function fakeSecret(n: number): string {
  return `FAKESECRET-${n}-xyz`;
}

/** Every fake secret the `secrets` fixtures carry; none may reach a snapshot. */
export const FAKE_SECRETS: string[] = Array.from({ length: 16 }, (_, i) => fakeSecret(i + 1));

export type Json = Record<string, unknown>;
/** A transcript line: a record object, or a raw (garbled) line. */
export type Line = Json | string;

/** A real-shaped `message.usage` whose four counted fields sum to `total`. */
export function usage(total: number): Json {
  const output = Math.min(total, 100);
  let rest = total - output;
  const input = Math.min(rest, 10);
  rest -= input;
  const cacheCreation = Math.min(rest, 1000);
  rest -= cacheCreation;
  return {
    input_tokens: input,
    cache_creation_input_tokens: cacheCreation,
    cache_read_input_tokens: rest,
    output_tokens: output,
  };
}

/** `number` → usage(n); object → as given; null → no usage key. */
export type UsageArg = number | Json | null;

export interface ToolCall {
  id: string;
  block: Json;
}

export interface TranscriptOptions {
  /** Seed for uuids and tool ids; distinct per file. */
  seed: string;
  sessionId: string;
  cwd: string;
  gitBranch?: string;
  version?: string;
  /** Offset of the first record from BASE, in ms. */
  startMs?: number;
  /** Time between records, in ms. */
  stepMs?: number;
  /** Mark records as sidechain (agent transcripts are all sidechain). */
  sidechain?: boolean;
  /** Extra top-level fields on every conversation record (agentId, agentName, teamName). */
  extra?: Json;
}

/** Builds the records of one transcript; state (clock, parent chain) advances per record. */
export class Transcript {
  readonly seed: string;
  readonly sessionId: string;
  cwd: string;
  gitBranch: string;
  version: string;
  sidechain: boolean;
  extra: Json;
  clockMs: number;
  stepMs: number;
  private count = 0;
  private parent: string | null = null;

  constructor(opts: TranscriptOptions) {
    this.seed = opts.seed;
    this.sessionId = opts.sessionId;
    this.cwd = opts.cwd;
    this.gitBranch = opts.gitBranch ?? 'main';
    this.version = opts.version ?? VERSION_NEW;
    this.sidechain = opts.sidechain ?? false;
    this.extra = opts.extra ?? {};
    this.clockMs = opts.startMs ?? 0;
    this.stepMs = opts.stepMs ?? 1000;
  }

  private nextId(prefix: string): string {
    this.count += 1;
    return syntheticUuid(`${this.seed}:${prefix}:${this.count}`);
  }

  private tick(): string {
    const t = at(this.clockMs);
    this.clockMs += this.stepMs;
    return t;
  }

  private record(type: string, message: Json | null, fields: Json = {}): Json {
    const uuid = this.nextId('uuid');
    const rec: Json = {
      parentUuid: this.parent,
      isSidechain: this.sidechain,
      userType: 'external',
      cwd: this.cwd,
      sessionId: this.sessionId,
      version: this.version,
      gitBranch: this.gitBranch,
      ...this.extra,
      type,
      ...fields,
    };
    if (message !== null) rec.message = message;
    rec.uuid = uuid;
    rec.timestamp = this.tick();
    this.parent = uuid;
    return rec;
  }

  private assistant(block: Json, stop: string | null, use: UsageArg): Json {
    const message: Json = { role: 'assistant', content: [block], stop_reason: stop };
    if (use !== null) message.usage = typeof use === 'number' ? usage(use) : use;
    return this.record('assistant', message);
  }

  /** A user prompt (string content, as real prompts). */
  prompt(text: string): Json {
    return this.record('user', { role: 'user', content: text });
  }

  /** An assistant record with one `tool_use` block; returns the record and the call (for toolResult/blob). */
  toolUse(name: string, input: Json, use: UsageArg): { rec: Json; call: ToolCall } {
    const id = `toolu_${this.nextId('tool').replace(/-/g, '').slice(0, 24)}`;
    const block: Json = { type: 'tool_use', id, name, input };
    return { rec: this.assistant(block, 'tool_use', use), call: { id, block } };
  }

  /** A user record with one `tool_result` block. */
  toolResult(call: ToolCall, text = 'ok', isError = false): Json {
    const block: Json = { tool_use_id: call.id, type: 'tool_result', content: text, is_error: isError };
    return this.record('user', { role: 'user', content: [block] });
  }

  /** An assistant record with one `text` block. */
  assistantText(stop: string | null, use: UsageArg, text = 'Done.'): Json {
    return this.assistant({ type: 'text', text }, stop, use);
  }

  /** An assistant record with one `thinking` block (stop_reason null: mid-turn). */
  thinking(text: string, use: UsageArg): Json {
    return this.assistant({ type: 'thinking', thinking: text, signature: 'fake-signature' }, null, use);
  }

  /** A `system` turn-end record (`stop_hook_summary` / `turn_duration`). */
  systemTurnEnd(subtype: string): Json {
    return this.record('system', null, { subtype, level: 'info' });
  }

  /** A title line: `custom-title` (customTitle), `agent-name` (agentName) or `ai-title` (aiTitle). */
  title(kind: 'custom-title' | 'agent-name' | 'ai-title', value: string): Json {
    const key = kind === 'custom-title' ? 'customTitle' : kind === 'agent-name' ? 'agentName' : 'aiTitle';
    return { type: kind, [key]: value, sessionId: this.sessionId };
  }

  /** An `api-request-blob` record carrying a copy of a tool_use block (must not count as an activity). */
  blob(call: ToolCall): Json {
    return {
      type: 'api-request-blob',
      sessionId: this.sessionId,
      message: { role: 'assistant', content: [call.block] },
      timestamp: this.tick(),
    };
  }
}

/** `n` lines that fail to parse as a JSON object (truncated JSON, arrays, null, numbers, text). */
export function garbled(n: number, seed = 'garbled'): string[] {
  const shape = (i: number): string => {
    switch (i % 5) {
      case 0:
        return `{"type":"assistant","message":{"content":[{"type":"text","te${i}`;
      case 1:
        return '[1,2,3]';
      case 2:
        return 'null';
      case 3:
        return `${i}`;
      default:
        return `not json ${seed} ${i}`;
    }
  };
  return Array.from({ length: n }, (_, i) => shape(i));
}

/** JSONL text of the lines: objects serialised, raw strings as given, one per line, trailing newline. */
export function jsonl(records: Line[]): string {
  return records.map((r) => (typeof r === 'string' ? r : JSON.stringify(r))).join('\n') + '\n';
}
