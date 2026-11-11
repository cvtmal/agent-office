import { describe, expect, it } from 'vitest';
import { globMatch } from './glob.js';

describe('globMatch', () => {
  it.each([
    // exact and anchored
    ['/home/user/code/x', '/home/user/code/x', true],
    ['/home/user/code/x', '/home/user/code/x/sub', false],
    ['/home/user/code/x', '/other/home/user/code/x', false],
    // case-sensitive
    ['/home/user/code/X', '/home/user/code/x', false],
    // `*` stays inside one segment
    ['/home/*/code/x', '/home/user/code/x', true],
    ['/home/*/code/x', '/home/a/b/code/x', false],
    ['/home/user/code/*', '/home/user/code/x', true],
    ['/home/user/code/*', '/home/user/code/x/y', false],
    ['/home/user/code/app-*', '/home/user/code/app-web', true],
    // `?` is one character, never `/`
    ['/home/user/code/x?', '/home/user/code/x1', true],
    ['/home/user/code/x?', '/home/user/code/x12', false],
    ['/home/user/code?x', '/home/user/code/x', false],
    // `**` crosses segments
    ['**/vendor/**', '/home/user/code/x/vendor/lib', true],
    ['**/vendor/**', '/home/user/code/x/vendor', true],
    ['**/vendor/**', '/home/user/code/x/vendored/lib', false],
    ['/home/user/**', '/home/user/code/x', true],
    ['/home/user/**', '/home/user', true],
    ['/home/user/**', '/home/username', false],
    ['/home/**/x', '/home/user/code/x', true],
    ['/home/**/x', '/home/x', true],
    ['/home/user/code/x**', '/home/user/code/x/.claude/worktrees/a', true],
    // regex characters are literal
    ['/home/user/code/a.b', '/home/user/code/aXb', false],
    ['/home/user/code/(x)+', '/home/user/code/(x)+', true],
  ])('%s vs %s → %s', (pattern, path, expected) => {
    expect(globMatch(pattern, path)).toBe(expected);
  });
});
