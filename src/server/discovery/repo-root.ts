// Repo root of a session cwd without a git process (research D5); worktrees belong to
// the parent repo (scope DATA-1).
import { existsSync } from 'node:fs';
import { dirname, join, relative } from 'node:path';

const WORKTREES = '/.claude/worktrees/';

/**
 * The prefix before `/.claude/worktrees/`; else the nearest ancestor (or `cwd` itself)
 * holding `.git` (dir or file); else `cwd`.
 */
export function repoRoot(cwd: string, exists: (path: string) => boolean = existsSync): string {
  const at = cwd.indexOf(WORKTREES);
  if (at >= 0) return cwd.slice(0, at) || '/';
  let dir = cwd;
  for (;;) {
    if (exists(join(dir, '.git'))) return dir;
    const parent = dirname(dir);
    if (parent === dir) return cwd;
    dir = parent;
  }
}

/** `cwd` relative to `root`; `.` for the root itself. */
export function whereIn(root: string, cwd: string): string {
  return relative(root, cwd) || '.';
}

/** `~/…` when `root` is under `home` (`~` for home itself), else the absolute path. */
export function displayPath(root: string, home: string): string {
  if (root === home) return '~';
  if (root.startsWith(`${home}/`)) return `~${root.slice(home.length)}`;
  return root;
}
