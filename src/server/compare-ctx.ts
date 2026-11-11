// `make compare-ctx`: the reader's characters of this repo against `bin/harness/ctx --json`
// (docs/rpi-cycles.md §1, research D4). Read-only; not a gate (always exits 0 unless ctx fails).
import { execFileSync } from 'node:child_process';
import { pathToFileURL } from 'node:url';
import type { Character } from '../shared/types.js';
import { repoRoot } from './discovery/index.js';
import type { LiveBy } from './reader/model.js';
import { scanSnapshot } from './snapshot.js';

/** The fields of one `ctx --json` row that are compared. */
export interface CtxRow {
  kind: string;
  status: string;
  tokens: number;
  verdict: string;
  session_id: string;
  agent_id: string | null;
}

export type DiffCategory = 'match' | 'explained' | 'mismatch' | 'only-ctx' | 'only-reader';

/** One key compared; `detail` names the differing fields only (never names or prompts). */
export interface DiffLine {
  key: string;
  category: DiffCategory;
  detail: string;
}

const CATEGORIES: readonly DiffCategory[] = ['match', 'explained', 'mismatch', 'only-ctx', 'only-reader'];

/** `session_id`, or `session_id/agent_id` for an agent row (the same shape as `Character.id`). */
export function ctxKey(row: CtxRow): string {
  return row.agent_id === null ? row.session_id : `${row.session_id}/${row.agent_id}`;
}

/** D4: a status difference with a known cause. */
function statusExplained(ctxStatus: string, ours: Character, liveBy: Map<string, LiveBy>): boolean {
  if (ctxStatus === 'live') return ours.status === 'busy' || ours.status === 'idle' || ours.status === 'waiting';
  if (ctxStatus === 'shell') return ours.status === 'busy';
  if (ctxStatus === 'ended') return ours.status !== 'ended' && liveBy.get(ours.sessionId) === 'teammate';
  return false;
}

function compare(row: CtxRow, ours: Character, liveBy: Map<string, LiveBy>): DiffLine {
  const key = ours.id;
  const hard: string[] = [];
  let explained: string | null = null;
  if (row.status !== ours.status) {
    const text = `status ${row.status}→${ours.status}`;
    if (statusExplained(row.status, ours, liveBy)) explained = text;
    else hard.push(text);
  }
  if (row.tokens !== ours.tokens) hard.push(`tokens ${row.tokens}→${ours.tokens}`);
  if (row.verdict !== ours.verdict) hard.push(`verdict ${row.verdict}→${ours.verdict}`);
  if (hard.length > 0) {
    const detail = explained === null ? hard : [...hard, `${explained} (explained)`];
    return { key, category: 'mismatch', detail: detail.join(', ') };
  }
  if (explained !== null) return { key, category: 'explained', detail: explained };
  return { key, category: 'match', detail: '' };
}

/** Per key (sorted): ctx rows against the characters of `projectId`. */
export function diffCtx(
  rows: CtxRow[],
  characters: Character[],
  liveBy: Map<string, LiveBy>,
  projectId: string,
): DiffLine[] {
  const ours = new Map<string, Character>();
  for (const c of characters) if (c.projectId === projectId) ours.set(c.id, c);
  const lines: DiffLine[] = [];
  const seen = new Set<string>();
  for (const row of rows) {
    const key = ctxKey(row);
    if (seen.has(key)) continue;
    seen.add(key);
    const c = ours.get(key);
    if (c === undefined) lines.push({ key, category: 'only-ctx', detail: `${row.kind} ${row.status}` });
    else lines.push(compare(row, c, liveBy));
  }
  for (const [key, c] of ours) {
    if (!seen.has(key)) lines.push({ key, category: 'only-reader', detail: `${c.kind} ${c.status}` });
  }
  return lines.sort((a, b) => (a.key < b.key ? -1 : a.key > b.key ? 1 : 0));
}

/** `N match, N explained, N mismatch, N only-ctx, N only-reader`. */
export function summary(lines: DiffLine[]): string {
  return CATEGORIES.map((cat) => `${lines.filter((l) => l.category === cat).length} ${cat}`).join(', ');
}

function main(): void {
  const root = repoRoot(process.cwd());
  let rows: CtxRow[];
  try {
    const out = execFileSync('bin/harness/ctx', ['--json'], { cwd: root, encoding: 'utf8' });
    const parsed: unknown = JSON.parse(out);
    if (!Array.isArray(parsed)) throw new Error('ctx --json did not print an array');
    rows = parsed as CtxRow[];
  } catch (err) {
    process.stderr.write(`compare-ctx: ${err instanceof Error ? err.message : String(err)}\n`);
    process.exit(2);
  }
  const { snapshot, liveBy } = scanSnapshot();
  const lines = diffCtx(rows, snapshot.characters, liveBy, root);
  for (const l of lines) {
    if (l.category !== 'match') process.stdout.write(`${l.category} ${l.key} ${l.detail}\n`);
  }
  process.stdout.write(`${summary(lines)}\n`);
}

const entry = process.argv[1];
if (entry !== undefined && import.meta.url === pathToFileURL(entry).href) main();
