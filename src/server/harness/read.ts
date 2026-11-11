// Reads a repo's harness files (DATA-6), read-only. A missing or unreadable file is an empty part.
import { execFileSync } from 'node:child_process';
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import type { HarnessExtras } from '../../shared/types.js';
import { parseGitLog, parseLanes, parseOutcomeNames, parseStateNow } from './parse.js';

/** Raw stdout of `git log -1` on `main` in `dir`, or null. Injectable for tests. */
export type GitLog = (dir: string) => string | null;

/** `git -C dir log -1 main` (read-only: no optional locks); null on any failure. */
export function gitLastCommit(dir: string): string | null {
  try {
    return execFileSync(
      'git',
      ['-C', dir, 'log', '-1', '--format=%H%x00%s%x00%ct', 'main', '--'],
      {
        encoding: 'utf8',
        timeout: 3000,
        maxBuffer: 1024 * 1024,
        stdio: ['ignore', 'pipe', 'ignore'],
        env: { ...process.env, GIT_OPTIONAL_LOCKS: '0', LC_ALL: 'C' },
      },
    );
  } catch {
    return null;
  }
}

function readText(path: string): string | null {
  try {
    return readFileSync(path, 'utf8');
  } catch {
    return null;
  }
}

function listNames(path: string): string[] | null {
  try {
    return readdirSync(path);
  } catch {
    return null;
  }
}

/**
 * The harness extras of the repo in `dir`, or null (and no `git` call) when none of
 * `.claude/harness/lanes.tsv`, `docs/harness/STATE.md`, `docs/outcomes/` exists. Never throws.
 */
export function readHarness(
  dir: string,
  { git = gitLastCommit }: { git?: GitLog } = {},
): HarnessExtras | null {
  const lanes = readText(join(dir, '.claude/harness/lanes.tsv'));
  const state = readText(join(dir, 'docs/harness/STATE.md'));
  const names = listNames(join(dir, 'docs/outcomes'));
  if (lanes === null && state === null && names === null) return null;
  return {
    lanes: parseLanes(lanes ?? ''),
    ...parseStateNow(state ?? ''),
    outcomes: parseOutcomeNames(names ?? []),
    lastCommit: parseGitLog(git(dir) ?? ''),
  };
}
