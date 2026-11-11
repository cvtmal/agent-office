import { describe, expect, it } from 'vitest';
import { displayPath, repoRoot, whereIn } from './repo-root.js';

const exists = (paths: string[]) => (path: string) => paths.includes(path);
const GIT = exists(['/home/dev/code/app/.git']);

describe('repoRoot', () => {
  it('maps a worktree to the parent repo', () => {
    expect(repoRoot('/home/dev/code/app/.claude/worktrees/lane-a', exists([]))).toBe('/home/dev/code/app');
    expect(repoRoot('/home/dev/code/app/.claude/worktrees/lane-a/src/server', GIT)).toBe('/home/dev/code/app');
  });

  it('walks up to the nearest .git', () => {
    expect(repoRoot('/home/dev/code/app/src/server', GIT)).toBe('/home/dev/code/app');
  });

  it('returns the root itself', () => {
    expect(repoRoot('/home/dev/code/app', GIT)).toBe('/home/dev/code/app');
  });

  it('returns the cwd outside any repo', () => {
    expect(repoRoot('/home/dev/scratch/notes', GIT)).toBe('/home/dev/scratch/notes');
  });
});

describe('whereIn', () => {
  it('is . for the root and a relative path below it', () => {
    expect(whereIn('/home/dev/code/app', '/home/dev/code/app')).toBe('.');
    expect(whereIn('/home/dev/code/app', '/home/dev/code/app/.claude/worktrees/lane-a')).toBe('.claude/worktrees/lane-a');
  });
});

describe('displayPath', () => {
  it('abbreviates paths under home', () => {
    expect(displayPath('/home/dev/code/app', '/home/dev')).toBe('~/code/app');
    expect(displayPath('/home/dev', '/home/dev')).toBe('~');
  });

  it('keeps paths outside home absolute', () => {
    expect(displayPath('/srv/app', '/home/dev')).toBe('/srv/app');
    expect(displayPath('/home/developer/app', '/home/dev')).toBe('/home/developer/app');
  });
});
