import { execFileSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { SNAPSHOT_VERSION } from '../../shared/constants.js';
import { validateSnapshot } from '../../shared/validate.js';
import { parseGitLog } from './parse.js';
import { gitLastCommit, readHarness } from './read.js';

const REPO_ROOT = join(dirname(fileURLToPath(import.meta.url)), '../../..');
const SHA = 'b'.repeat(40);
const GIT_LINE = `${SHA}\0land: x\0${1767225600}\n`;

let base: string;
let n = 0;

/** A fresh empty directory under the temp base. */
function fresh(): string {
  const dir = join(base, `d${n++}`);
  mkdirSync(dir);
  return dir;
}

function put(dir: string, rel: string, content: string | Buffer): void {
  mkdirSync(dirname(join(dir, rel)), { recursive: true });
  writeFileSync(join(dir, rel), content);
}

beforeAll(() => {
  base = mkdtempSync(join(tmpdir(), 'ao-harness-'));
});

afterAll(() => {
  rmSync(base, { recursive: true, force: true });
});

const EMPTY = { lanes: [], ctoGeneration: null, phase: null, wave: null, outcomes: [] };

describe('readHarness', () => {
  it('gives null for a non-harness dir and does not call git', () => {
    const git = vi.fn(() => GIT_LINE);
    expect(readHarness(fresh(), { git })).toBeNull();
    expect(readHarness(join(base, 'missing'), { git })).toBeNull();
    expect(git).not.toHaveBeenCalled();
  });

  it('gives empty parts when only one source exists', () => {
    const git = (): string => GIT_LINE;
    const commit = { sha: SHA, subject: 'land: x', at: '2026-01-01T00:00:00.000Z' };

    const a = fresh();
    put(a, '.claude/harness/lanes.tsv', '#slug\tlane\tport\tcreated\n');
    expect(readHarness(a, { git })).toEqual({ ...EMPTY, lastCommit: commit });

    const b = fresh();
    put(b, 'docs/harness/STATE.md', '# State\n');
    expect(readHarness(b, { git })).toEqual({ ...EMPTY, lastCommit: commit });

    const c = fresh();
    mkdirSync(join(c, 'docs/outcomes'), { recursive: true });
    expect(readHarness(c, { git })).toEqual({ ...EMPTY, lastCommit: commit });
  });

  it('survives garbage content', () => {
    const d = fresh();
    put(d, '.claude/harness/lanes.tsv', Buffer.from([0, 255, 1, 9, 128, 7]));
    put(d, 'docs/harness/STATE.md', Buffer.from([0, 255, 35, 35, 9, 128]));
    expect(readHarness(d, { git: () => 'not a log' })).toEqual({ ...EMPTY, lastCommit: null });
  });

  it('treats a lanes.tsv that is a directory as missing', () => {
    const d = fresh();
    mkdirSync(join(d, '.claude/harness/lanes.tsv'), { recursive: true });
    expect(readHarness(d, { git: () => null })).toBeNull();
    put(d, 'docs/outcomes/03-c.md', '');
    expect(readHarness(d, { git: () => null })).toEqual({
      ...EMPTY,
      outcomes: [{ nn: 3, slug: 'c' }],
      lastCommit: null,
    });
  });

  it('reads the harness replay fixture: lanes A–C and the landed cycle', () => {
    const harness = readHarness(join(REPO_ROOT, 'fixtures/replay/harness/repo'), { git: () => null });
    expect(harness).toEqual({
      lanes: [
        { slug: 'session-store', letter: 'A', port: 8001, worktree: '.claude/worktrees/session-store' },
        { slug: 'theme-tokens', letter: 'B', port: 8002, worktree: '.claude/worktrees/theme-tokens' },
        { slug: 'replay-player', letter: 'C', port: 8003, worktree: '.claude/worktrees/replay-player' },
      ],
      ctoGeneration: 1,
      phase: null,
      wave: 'W1',
      outcomes: [
        { nn: 0, slug: 'bootstrap' },
        { nn: 1, slug: 'session-store' },
      ],
      lastCommit: null,
    });
    const snap = {
      version: SNAPSHOT_VERSION,
      generatedAt: '2026-01-01T00:00:00.000Z',
      projects: [
        {
          id: '/home/dev/repo',
          name: 'repo',
          displayPath: '~/repo',
          harness,
          health: { lines: 1, failed: 0, drift: false, version: '9.9.1' },
        },
      ],
      characters: [],
      activities: [],
    };
    expect(validateSnapshot(snap)).toEqual([]);
  });
});

function hasGit(): boolean {
  try {
    execFileSync('git', ['--version'], { stdio: 'ignore' });
    return true;
  } catch {
    return false;
  }
}

describe.skipIf(!hasGit())('gitLastCommit (real git, temp repo)', () => {
  const env = {
    ...process.env,
    GIT_AUTHOR_NAME: 'Test',
    GIT_AUTHOR_EMAIL: 'test@example.invalid',
    GIT_AUTHOR_DATE: '2026-01-02T03:04:05Z',
    GIT_COMMITTER_NAME: 'Test',
    GIT_COMMITTER_EMAIL: 'test@example.invalid',
    GIT_COMMITTER_DATE: '2026-01-02T03:04:05Z',
    GIT_CONFIG_NOSYSTEM: '1',
    GIT_CONFIG_GLOBAL: '/dev/null',
  };
  const git = (dir: string, ...args: string[]): string =>
    execFileSync('git', ['-C', dir, '-c', 'commit.gpgsign=false', ...args], {
      env,
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore'],
    });

  it('reads the last commit on main', () => {
    const d = fresh();
    git(d, 'init', '-q', '-b', 'main');
    git(d, 'commit', '-q', '--allow-empty', '-m', 'first: one');
    const sha = git(d, 'rev-parse', 'HEAD').trim();
    expect(parseGitLog(gitLastCommit(d) ?? '')).toEqual({
      sha,
      subject: 'first: one',
      at: '2026-01-02T03:04:05.000Z',
    });
  });

  it('gives null outside a repo and without a main branch', () => {
    expect(gitLastCommit(fresh())).toBeNull();
    const d = fresh();
    git(d, 'init', '-q', '-b', 'master');
    git(d, 'commit', '-q', '--allow-empty', '-m', 'x');
    expect(gitLastCommit(d)).toBeNull();
  });
});
