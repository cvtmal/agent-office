/**
 * Retained records (live-api research R1, Q-B): the bounded part of a transcript that every reader
 * derivation can still pick, so a tailed file never has to be kept or re-read whole (RUN-3 memory).
 * Every derivation is "newest record matching X" (per partition: all records, or the file's main
 * records) or "the last N tool calls"; keeping, in file order, the newest record of each selector plus
 * the records holding the last ACTIVITIES_PER_CHARACTER tool calls gives `buildModel` the same result as
 * the whole file. Pure: no file or process access.
 */
import { ACTIVITIES_PER_CHARACTER, DRIFT_WINDOW_LINES } from '../../shared/constants.js';
import { mainRecords, type Block, type FileKind, type ParsedTranscript, type Rec } from './records.js';
import { clean } from './target.js';

/** A file's retained records and its last DRIFT_WINDOW_LINES line flags; usable as `RawSession.parsed`. */
export interface Retained {
  records: Rec[];
  lineOk: boolean[];
}

/** `system` subtypes that close a turn (mirrors `status.ts:13`). */
const TURN_END_SUBTYPES = new Set(['stop_hook_summary', 'turn_duration']);

const named = (value: string | null): boolean => value !== null && clean(value) !== '';

/**
 * Every "newest record for which …" scan the reader runs. Each is applied to both partitions
 * (all records and `mainRecords(…, kind)`), a superset of what each consumer reads.
 */
export const SELECTORS: Record<string, (rec: Rec) => boolean> = {
  /** `status.ts:15-33` `isRelevant`, last main record. */
  status: (rec) =>
    rec.type === 'user' ||
    rec.type === 'assistant' ||
    (rec.type === 'system' && rec.subtype !== null && TURN_END_SUBTYPES.has(rec.subtype)),
  /** `tokens.ts:17-31` last assistant usage with a sum > 0 (also the placement cwd, `model.ts:176, 209`). */
  usage: (rec) =>
    rec.type === 'assistant' &&
    rec.usage !== null &&
    rec.usage.input + rec.usage.cacheCreation + rec.usage.cacheRead + rec.usage.output > 0,
  /** `names.ts:48` newest `custom-title` record. */
  customTitle: (rec) => rec.type === 'custom-title' && named(rec.customTitle),
  /** `names.ts:49` newest `agent-name` record. */
  agentNameRecord: (rec) => rec.type === 'agent-name' && named(rec.agentName),
  /** `names.ts:50, 60` newest record `agentName`. */
  agentName: (rec) => named(rec.agentName),
  /** `names.ts:51` newest `ai-title` record. */
  aiTitle: (rec) => rec.type === 'ai-title' && named(rec.aiTitle),
  /** `model.ts:141` `gitBranch`. */
  gitBranch: (rec) => rec.gitBranch !== null,
  /** `model.ts:143` `teamName`. */
  teamName: (rec) => rec.teamName !== null,
  /** `model.ts:55-58` team pair (liveness of teammates). */
  teamPair: (rec) => rec.agentName !== null && rec.teamName !== null,
  /** `health.ts:24-31` `version`. */
  version: (rec) => rec.version !== null,
};

/**
 * The `tool_use.input` keys `shapeTarget` reads (`target.ts:73-96`, browser tools `:58-64`); every other
 * key (Write content, Edit strings, prompts) is dropped from retained records. Only string values are
 * kept: `field()` (`target.ts:42-45`) treats anything else as `''`.
 */
export const TARGET_KEYS: readonly string[] = [
  'file_path',
  'notebook_path',
  'filePath',
  'path',
  'pattern',
  'command',
  'url',
  'subagent_type',
  'name',
  'to',
  'skill',
  'action',
];

export function emptyRetained(): Retained {
  return { records: [], lineOk: [] };
}

export interface RetainOptions {
  /** Detail mode: keep each tool input whole (`activity.ts` turns it into `detail`); default: TARGET_KEYS only. */
  keepInput?: boolean;
}

function slimBlock(block: Block, { keepInput = false }: RetainOptions = {}): Block {
  if (block.type !== 'tool_use' || keepInput) return block;
  const input: Record<string, unknown> = {};
  for (const key of TARGET_KEYS) {
    const value = block.input[key];
    if (typeof value === 'string') input[key] = value;
  }
  return { type: 'tool_use', name: block.name, input };
}

/**
 * A record with tool inputs reduced to TARGET_KEYS, or kept whole with `keepInput` (text, thinking and
 * tool results carry no body already).
 */
function slim(rec: Rec, opts: RetainOptions): Rec {
  if (opts.keepInput === true || !rec.content.some((block) => block.type === 'tool_use')) return rec;
  return { ...rec, content: rec.content.map((block) => slimBlock(block, opts)) };
}

/** Records holding the last `n` timestamped `tool_use` blocks of assistant records (`activity.ts:12-36`). */
function lastToolRecords(records: Rec[], n: number, keep: Set<Rec>): void {
  let count = 0;
  for (let i = records.length - 1; i >= 0 && count < n; i--) {
    const rec = records[i];
    if (rec === undefined || rec.type !== 'assistant' || rec.timestamp === null) continue;
    const tools = rec.content.filter((block) => block.type === 'tool_use').length;
    if (tools > 0) {
      keep.add(rec);
      count += tools;
    }
  }
}

/**
 * `prev` plus the next parsed chunk of the same file, reduced again to what the reader can pick.
 * `opts.keepInput` (detail mode) keeps tool inputs whole; the records kept are the same either way.
 */
export function retain(prev: Retained, chunk: ParsedTranscript, kind: FileKind, opts: RetainOptions = {}): Retained {
  const fresh = chunk.records.map((rec) => slim(rec, opts));
  const all = prev.records.length === 0 ? fresh : prev.records.concat(fresh);
  const keep = new Set<Rec>();
  const main = mainRecords(all, kind);
  for (const partition of [all, main]) {
    for (const select of Object.values(SELECTORS)) {
      for (let i = partition.length - 1; i >= 0; i--) {
        const rec = partition[i];
        if (rec !== undefined && select(rec)) {
          keep.add(rec);
          break;
        }
      }
    }
  }
  lastToolRecords(main, ACTIVITIES_PER_CHARACTER, keep);
  return {
    records: all.filter((rec) => keep.has(rec)),
    lineOk: prev.lineOk.concat(chunk.lineOk).slice(-DRIFT_WINDOW_LINES),
  };
}
