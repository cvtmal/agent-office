// Pure parsers for the harness files of a repo (DATA-6). No IO: `read.ts` feeds them text.
import { LANE_LETTERS, type LaneLetter } from '../../shared/constants.js';
import type {
  CommitRef,
  HarnessExtras,
  Lane,
  LaneRef,
  Outcome,
} from '../../shared/types.js';
import { clean } from '../reader/target.js';

/** Where `bin/harness/lane` puts a lane's worktree, relative to the repo root. */
export const WORKTREE_PREFIX = '.claude/worktrees/';

const SLUG = /^[A-Za-z0-9._-]+$/;
const OUTCOME_NAME = /^(\d+)-([A-Za-z0-9._-]+)\.md$/;
const SHA = /^[0-9a-f]{40}$/;
const PHASE_MAX = 80;
const SUBJECT_MAX = 120;

function isLaneLetter(s: string): s is LaneLetter {
  return (LANE_LETTERS as readonly string[]).includes(s);
}

/**
 * `.claude/harness/lanes.tsv`: TAB-separated `slug, letter, port[, created]`. `#` lines, blank
 * lines and malformed rows are skipped; the first row per slug wins; sorted by letter.
 */
export function parseLanes(text: string): Lane[] {
  const bySlug = new Map<string, Lane>();
  for (const raw of text.split('\n')) {
    const line = raw.replace(/\r$/, '');
    if (line.trim() === '' || line.startsWith('#')) continue;
    const [slug, letter, port] = line.split('\t');
    if (slug === undefined || letter === undefined || port === undefined) continue;
    if (!SLUG.test(slug) || !isLaneLetter(letter) || !/^\d+$/.test(port)) continue;
    const portNo = Number(port);
    if (portNo < 1 || portNo > 65535) continue;
    if (bySlug.has(slug)) continue;
    bySlug.set(slug, { slug, letter, port: portNo, worktree: WORKTREE_PREFIX + slug });
  }
  return [...bySlug.values()].sort((a, b) => a.letter.localeCompare(b.letter));
}

/** Markdown emphasis and backticks removed, then `clean()` with `max`. */
function plain(s: string, max: number): string {
  return clean(s.replace(/\*\*|[*_`]/g, ''), max);
}

/**
 * `docs/harness/STATE.md` § Now: bullets `- **Label:** value` or `- Label: value`. Labels are
 * case-insensitive: `CTO generation` (first integer), `Phase` / `Phase of the project` (text,
 * ≤ 80 characters), `Wave` / `Wave in progress` (leading `W<n>` token). Missing → null.
 */
export function parseStateNow(text: string): {
  ctoGeneration: number | null;
  phase: string | null;
  wave: string | null;
} {
  const out: { ctoGeneration: number | null; phase: string | null; wave: string | null } = {
    ctoGeneration: null,
    phase: null,
    wave: null,
  };
  let inNow = false;
  for (const raw of text.split('\n')) {
    const line = raw.replace(/\r$/, '');
    if (/^##\s/.test(line)) {
      inNow = /^##\s+Now\b/.test(line);
      continue;
    }
    if (!inNow) continue;
    const bullet = /^[-*]\s+(.+?):\s*(.*)$/.exec(line.replace(/\*\*/g, ''));
    if (bullet === null) continue;
    const label = (bullet[1] ?? '').trim().toLowerCase();
    const value = bullet[2] ?? '';
    if (label === 'cto generation') {
      const n = /\d+/.exec(value);
      out.ctoGeneration = n === null ? null : Number(n[0]);
    } else if (label === 'phase' || label === 'phase of the project') {
      const phase = plain(value, PHASE_MAX);
      out.phase = phase === '' ? null : phase;
    } else if (label === 'wave' || label === 'wave in progress') {
      const w = /^W\d+/.exec(plain(value, PHASE_MAX));
      out.wave = w === null ? null : w[0];
    }
  }
  return out;
}

/** File names in `docs/outcomes/`: `<nn>-<slug>.md` → `{nn, slug}`, sorted by nn, then slug. */
export function parseOutcomeNames(names: readonly string[]): Outcome[] {
  const out: Outcome[] = [];
  for (const name of names) {
    const m = OUTCOME_NAME.exec(name);
    if (m === null) continue;
    out.push({ nn: Number(m[1]), slug: m[2] ?? '' });
  }
  return out.sort((a, b) => a.nn - b.nn || a.slug.localeCompare(b.slug));
}

/** `git log -1 --format=%H%x00%s%x00%ct` stdout → commit; null when any field is invalid. */
export function parseGitLog(stdout: string): CommitRef | null {
  const [sha, subject, ct, ...rest] = stdout.replace(/\r?\n$/, '').split('\0');
  if (sha === undefined || subject === undefined || ct === undefined || rest.length > 0) {
    return null;
  }
  if (!SHA.test(sha) || !/^\d+$/.test(ct)) return null;
  const at = new Date(Number(ct) * 1000);
  if (Number.isNaN(at.getTime())) return null;
  return { sha, subject: clean(subject, SUBJECT_MAX), at: at.toISOString() };
}

/** The lane slug of a repo-relative `where` (`.claude/worktrees/<slug>[/…]`), else null. */
export function laneSlugOf(where: string): string | null {
  if (!where.startsWith(WORKTREE_PREFIX)) return null;
  const slug = where.slice(WORKTREE_PREFIX.length).split('/')[0] ?? '';
  return slug === '' ? null : slug;
}

/** The lane a character at `where` works in, from the project's harness; else null. */
export function laneOf(where: string, harness: HarnessExtras | null): LaneRef | null {
  if (harness === null) return null;
  const slug = laneSlugOf(where);
  if (slug === null) return null;
  const lane = harness.lanes.find((l) => l.slug === slug);
  return lane === undefined ? null : { slug: lane.slug, letter: lane.letter, port: lane.port };
}
