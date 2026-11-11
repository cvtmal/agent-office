import { readdirSync, readFileSync } from 'node:fs';
import { dirname, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { DRIFT_WINDOW_LINES, THRESHOLDS } from '../../shared/constants.js';
import type { Snapshot } from '../../shared/types.js';
import type { Discovered, RawAgent, RawSession, TeammateProc } from '../discovery/types.js';
import { buildSnapshot, type ModelOptions } from './model.js';
import { parseTranscript, type FileKind, type ParsedTranscript } from './records.js';
import { emptyRetained, retain, type Retained } from './retain.js';

const REPO_ROOT = join(dirname(fileURLToPath(import.meta.url)), '../../..');
const CWD = '/home/dev/code/app';

const opts: ModelOptions = {
  now: new Date('2026-01-01T12:00:00.000Z'),
  home: '/home/dev',
  thresholds: THRESHOLDS,
  rootOf: (cwd) => cwd.split('/.claude/worktrees/')[0] ?? cwd,
};

type Source = { text: string } | { parsed: ParsedTranscript };
type Variant = 'registry' | 'teammate' | 'ended';
const VARIANTS: Variant[] = ['registry', 'teammate', 'ended'];

/** A session file, or an agent file under a parent session, as one `Discovered`. */
function discovered(kind: FileKind, source: Source, variant: Variant, pairs: TeammateProc[]): Discovered {
  const text = 'text' in source ? source.text : '';
  const parsed = 'parsed' in source ? source.parsed : undefined;
  const entry = { pid: 1, procStart: null, status: null, updatedAt: 0, cwd: CWD, name: null };
  if (kind === 'session') {
    const s: RawSession = { sessionId: 's1', path: '/x/s1.jsonl', mtimeMs: 0, text, customTitle: null };
    if (parsed !== undefined) s.parsed = parsed;
    return {
      sessions: [s],
      agents: [],
      registry: variant === 'registry' ? new Map([['s1', { ...entry, sessionId: 's1' }]]) : new Map(),
      teammates: variant === 'teammate' ? pairs : [],
    };
  }
  const parentLine = JSON.stringify({
    type: 'assistant',
    timestamp: '2026-01-01T00:00:00.000Z',
    cwd: CWD,
    message: { content: [], stop_reason: 'end_turn', usage: { input_tokens: 5 } },
  });
  const parent: RawSession = { sessionId: 'p1', path: '/x/p1.jsonl', mtimeMs: 0, text: parentLine, customTitle: null };
  const a: RawAgent = { sessionId: 'p1', agentId: 'a1', path: '/x/p1/subagents/agent-a1.jsonl', mtimeMs: 0, text, meta: null };
  if (parsed !== undefined) a.parsed = parsed;
  return {
    sessions: [parent],
    agents: [a],
    registry: variant === 'ended' ? new Map() : new Map([['p1', { ...entry, sessionId: 'p1' }]]),
    teammates: [],
  };
}

function snapshots(kind: FileKind, source: Source, pairs: TeammateProc[]): Snapshot[] {
  return VARIANTS.map((variant) => buildSnapshot(discovered(kind, source, variant, pairs), opts));
}

/** Every team pair in a file, so the teammate variant makes it live. */
function pairsOf(text: string): TeammateProc[] {
  const pairs: TeammateProc[] = [];
  for (const rec of parseTranscript(text).records) {
    if (rec.agentName !== null && rec.teamName !== null) pairs.push({ agentName: rec.agentName, teamName: rec.teamName });
  }
  return pairs;
}

const joinLines = (lines: string[]): string => (lines.length === 0 ? '' : lines.join('\n') + '\n');

/**
 * Feeds `full` chunk by chunk (every line, or every 5th for files > 100 lines) and checks the
 * snapshots over the retained set against the snapshots over the text after every chunk; then
 * checks every two-chunk cut against the whole file.
 */
function expectEquivalent(full: string, kind: FileKind): void {
  const lines = full.split('\n');
  if (lines.at(-1) === '') lines.pop();
  const pairs = pairsOf(full);
  const step = lines.length > 100 ? 5 : 1;
  const cuts: number[] = [];
  for (let k = step; k < lines.length; k += step) cuts.push(k);
  cuts.push(lines.length);

  let state: Retained = emptyRetained();
  let from = 0;
  for (const k of cuts) {
    state = retain(state, parseTranscript(joinLines(lines.slice(from, k))), kind);
    from = k;
    const prefix = joinLines(lines.slice(0, k));
    expect(snapshots(kind, { parsed: state }, pairs), `after line ${k}`).toEqual(snapshots(kind, { text: prefix }, pairs));
  }

  const whole = snapshots(kind, { text: full }, pairs);
  for (const k of cuts) {
    const head = retain(emptyRetained(), parseTranscript(joinLines(lines.slice(0, k))), kind);
    const both = retain(head, parseTranscript(joinLines(lines.slice(k))), kind);
    expect(snapshots(kind, { parsed: both }, pairs), `cut at line ${k}`).toEqual(whole);
  }
}

function filesUnder(dir: string): string[] {
  return (readdirSync(dir, { recursive: true }) as string[])
    .filter((name) => name.endsWith('.jsonl'))
    .map((name) => join(dir, name))
    .sort();
}

const fixtureFiles: [string, FileKind][] = [
  ...filesUnder(join(REPO_ROOT, 'fixtures/transcripts/cases')).map((f): [string, FileKind] => [f, 'session']),
  ...['harness', 'solo'].flatMap((set) =>
    filesUnder(join(REPO_ROOT, 'fixtures/replay', set, 'config')).map((f): [string, FileKind] => [
      f,
      f.includes('/subagents/') ? 'agent' : 'session',
    ]),
  ),
];

const T0 = Date.parse('2026-01-01T00:00:00.000Z');
const at = (s: number): string => new Date(T0 + s * 1000).toISOString();
const usage = { input_tokens: 100, cache_creation_input_tokens: 0, cache_read_input_tokens: 0, output_tokens: 10 };

/** An assistant tool call; `bare` drops every selector field and makes the usage zero (synthetic). */
function toolCall(s: number, name: string, input: Record<string, unknown>, extra: Record<string, unknown> = {}, bare = false): string {
  const fields = bare ? {} : { cwd: CWD, gitBranch: 'main', version: '9.9.1' };
  return JSON.stringify({
    type: 'assistant',
    timestamp: at(s),
    ...fields,
    ...extra,
    message: {
      content: [{ type: 'tool_use', id: `t${s}`, name, input }],
      stop_reason: 'tool_use',
      usage: bare ? { input_tokens: 0, output_tokens: 0 } : usage,
    },
  });
}

describe('retain: equivalence with the whole file', () => {
  it('finds the fixture files', () => {
    expect(fixtureFiles.length).toBeGreaterThanOrEqual(19 + 7);
  });

  for (const [file, kind] of fixtureFiles) {
    it(`${relative(REPO_ROOT, file)} (${kind}) at every line cut`, () => {
      expectEquivalent(readFileSync(file, 'utf8'), kind);
    });
  }

  // Each selector's field sits on one early record only (a newer sidechain record carries
  // `version`), so every SELECTORS entry and both partitions are load-bearing; dropping the
  // higher-priority names exposes the lower name fallbacks (`names.ts:45-53`).
  const dropSets: string[][] = [[], ['customTitle'], ['customTitle', 'agentName']];
  for (const kind of ['session', 'agent'] as const) for (const drop of dropSets) {
    it(`a file with sparse fields (${kind}, without ${drop.join(', ') || 'nothing'})`, () => {
      const rec = (r: Record<string, unknown>): string => JSON.stringify({ type: 'attachment', ...r });
      const unless = (field: string, line: string): string[] => (drop.includes(field) ? [] : [line]);
      const lines = [
        JSON.stringify({ type: 'user', timestamp: at(0), message: { content: 'go' } }),
        ...unless('customTitle', rec({ type: 'custom-title', customTitle: 'titled' })),
        ...unless('agentName', rec({ type: 'agent-name', agentName: 'named' })),
        ...unless('agentName', rec({ agentName: 'pair-agent', teamName: 'pair-team' })),
        ...unless('agentName', rec({ agentName: 'solo-agent' })),
        rec({ teamName: 'solo-team' }),
        rec({ type: 'ai-title', aiTitle: 'ai titled' }),
        rec({ gitBranch: 'feature' }),
        rec({ version: '1.2.3', timestamp: at(1) }),
        JSON.stringify({
          type: 'assistant',
          timestamp: at(2),
          cwd: CWD,
          message: { content: [{ type: 'text', text: 'hi' }], stop_reason: 'end_turn', usage },
        }),
        ...Array.from({ length: 15 }, (_, i) => toolCall(10 + i, 'Read', { file_path: `${CWD}/f${i}.ts` }, {}, true)),
        rec({ isSidechain: true, version: '9.9.9', timestamp: at(30), agentName: 'side' }),
        JSON.stringify({ type: 'system', subtype: 'turn_duration', timestamp: at(31) }),
        ...Array.from({ length: 5 }, (_, i) => rec({ timestamp: at(40 + i) })),
      ];
      expectEquivalent(joinLines(lines), kind);
    });
  }
});

/** Total length of the tool inputs a retained set still holds. */
function inputBytes(r: Retained): number {
  let n = 0;
  for (const rec of r.records) {
    for (const block of rec.content) if (block.type === 'tool_use') n += JSON.stringify(block.input).length;
  }
  return n;
}

describe('retain: bounded memory', () => {
  it('drops Write content: 50 calls of 100 KB retain < 20 KB of input strings', () => {
    const big = 'x'.repeat(100 * 1024);
    let state = emptyRetained();
    for (let i = 0; i < 50; i++) {
      const line = toolCall(i, 'Write', { file_path: `${CWD}/src/f${i}.ts`, content: big });
      state = retain(state, parseTranscript(line + '\n'), 'session');
    }
    expect(inputBytes(state)).toBeLessThan(20 * 1024);
    const inputs = state.records.flatMap((rec) => rec.content.flatMap((b) => (b.type === 'tool_use' ? [b.input] : [])));
    expect(inputs.every((input) => !('content' in input))).toBe(true);
  });

  it('keeps whole tool inputs with keepInput (detail mode), the same records either way', () => {
    const lines = Array.from({ length: 15 }, (_, i) =>
      toolCall(i, 'Edit', { file_path: `${CWD}/src/f${i}.ts`, old_string: `a${i}`, new_string: `b${i}`, replace_all: false }),
    );
    let kept = emptyRetained();
    let slimmed = emptyRetained();
    for (const line of lines) {
      kept = retain(kept, parseTranscript(line + '\n'), 'session', { keepInput: true });
      slimmed = retain(slimmed, parseTranscript(line + '\n'), 'session');
    }
    const inputs = kept.records.flatMap((rec) => rec.content.flatMap((b) => (b.type === 'tool_use' ? [b.input] : [])));
    expect(inputs).toHaveLength(10);
    expect(inputs.at(-1)).toEqual({ file_path: `${CWD}/src/f14.ts`, old_string: 'a14', new_string: 'b14', replace_all: false });
    expect(kept.records.map((rec) => rec.timestamp)).toEqual(slimmed.records.map((rec) => rec.timestamp));
  });

  it('keeps ≤ 40 records for a 2 000-line file, with the same snapshot', () => {
    const lines: string[] = [];
    for (let i = 0; lines.length < 2000; i++) {
      const s = i * 10;
      lines.push(JSON.stringify({ type: 'user', timestamp: at(s), cwd: CWD, message: { content: 'go' } }));
      lines.push(toolCall(s + 1, 'Bash', { command: `npm test -- ${i}`, description: 'run' }, { teamName: `t${i % 3}` }));
      lines.push(toolCall(s + 2, 'Read', { file_path: `${CWD}/f${i}.ts` }, { isSidechain: i % 4 === 0 }));
      lines.push(
        JSON.stringify({
          type: 'user',
          timestamp: at(s + 3),
          message: { content: [{ type: 'tool_result', content: 'output', tool_use_id: `t${s + 1}` }] },
        }),
      );
      lines.push(
        JSON.stringify({
          type: 'assistant',
          timestamp: at(s + 4),
          cwd: CWD,
          agentName: i % 5 === 0 ? `agent-${i}` : undefined,
          message: { content: [{ type: 'text', text: 'done' }], stop_reason: 'end_turn', usage },
        }),
      );
      lines.push(JSON.stringify({ type: 'system', subtype: 'turn_duration', timestamp: at(s + 5) }));
      if (i % 7 === 0) lines.push(JSON.stringify({ type: 'custom-title', customTitle: `title ${i}` }));
      if (i % 11 === 0) lines.push(JSON.stringify({ type: 'ai-title', aiTitle: `ai ${i}` }));
      if (i % 13 === 0) lines.push('not json');
    }
    lines.length = 2000;

    let state = emptyRetained();
    let most = 0;
    for (let k = 0; k < lines.length; k += 7) {
      state = retain(state, parseTranscript(joinLines(lines.slice(k, k + 7))), 'session');
      most = Math.max(most, state.records.length);
    }
    expect(most).toBeLessThanOrEqual(40);
    expect(state.lineOk.length).toBe(DRIFT_WINDOW_LINES);
    const full = joinLines(lines);
    expect(snapshots('session', { parsed: state }, pairsOf(full))).toEqual(snapshots('session', { text: full }, pairsOf(full)));
  });
});
