import { mkdirSync, mkdtempSync, realpathSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { configDir } from './config-dir.js';

let tmp: string;

beforeEach(() => {
  tmp = mkdtempSync(join(tmpdir(), 'ao-cfgdir-'));
});

afterEach(() => {
  rmSync(tmp, { recursive: true, force: true });
});

describe('configDir', () => {
  it('uses CLAUDE_CONFIG_DIR when set, as its real path', () => {
    const dir = join(tmp, 'cfg');
    mkdirSync(dir);
    expect(configDir({ CLAUDE_CONFIG_DIR: dir }, '/home/dev')).toBe(realpathSync(dir));
  });

  it('expands ~/x with home', () => {
    mkdirSync(join(tmp, 'x'));
    expect(configDir({ CLAUDE_CONFIG_DIR: '~/x' }, tmp)).toBe(realpathSync(join(tmp, 'x')));
  });

  it('falls back to <home>/.claude when unset or empty', () => {
    expect(configDir({}, '/home/dev')).toBe('/home/dev/.claude');
    expect(configDir({ CLAUDE_CONFIG_DIR: '' }, '/home/dev')).toBe('/home/dev/.claude');
  });

  it('returns the resolved path when the dir is missing', () => {
    expect(configDir({ CLAUDE_CONFIG_DIR: '/home/dev/missing/../cfg' }, '/home/dev')).toBe('/home/dev/cfg');
    expect(configDir({ CLAUDE_CONFIG_DIR: '~/nope' }, '/home/dev')).toBe('/home/dev/nope');
  });
});
