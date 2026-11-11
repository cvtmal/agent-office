import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { MAX_AGE_HOURS } from '../../shared/constants.js';
import { configPath, DEFAULT_CONFIG, loadConfig } from './file.js';

const HOME = '/home/user';
const DEFAULT_PATH = '/home/user/.config/agent-office/config.json';

/** Loads `json` (an object, serialised) as if it were the default config file. */
function load(json: unknown): ReturnType<typeof loadConfig> {
  return loadConfig({ env: {}, home: HOME, read: () => JSON.stringify(json) });
}

function enoent(): never {
  throw Object.assign(new Error('ENOENT: no such file'), { code: 'ENOENT' });
}

describe('configPath', () => {
  it('prefers the flag', () => {
    expect(configPath({ flag: 'my.json', env: { XDG_CONFIG_HOME: '/xdg' }, home: HOME })).toBe('my.json');
  });

  it('uses XDG_CONFIG_HOME', () => {
    expect(configPath({ env: { XDG_CONFIG_HOME: '/home/user/xdg' }, home: HOME })).toBe('/home/user/xdg/agent-office/config.json');
  });

  it('falls back to ~/.config', () => {
    expect(configPath({ env: {}, home: HOME })).toBe(DEFAULT_PATH);
    expect(configPath({ env: { XDG_CONFIG_HOME: '' }, home: HOME })).toBe(DEFAULT_PATH);
  });
});

describe('loadConfig: the file', () => {
  it('a missing default file gives the defaults and no problem', () => {
    const out = loadConfig({ env: {}, home: HOME, read: enoent });
    expect(out).toEqual({ config: DEFAULT_CONFIG, problems: [], path: DEFAULT_PATH });
  });

  it('a missing --config file gives the defaults and one problem', () => {
    const out = loadConfig({ flag: '/home/user/nope.json', env: {}, home: HOME, read: enoent });
    expect(out.config).toEqual(DEFAULT_CONFIG);
    expect(out.problems).toHaveLength(1);
    expect(out.problems[0]).toMatch(/nope\.json: file not found/);
  });

  it('reads the XDG path', () => {
    const seen: string[] = [];
    loadConfig({
      env: { XDG_CONFIG_HOME: '/home/user/xdg' },
      home: HOME,
      read: (path) => {
        seen.push(path);
        return '{}';
      },
    });
    expect(seen).toEqual(['/home/user/xdg/agent-office/config.json']);
  });

  it('invalid JSON gives the defaults and one problem', () => {
    const out = loadConfig({ env: {}, home: HOME, read: () => '{ "maxAgeHours": 2,' });
    expect(out.config).toEqual(DEFAULT_CONFIG);
    expect(out.problems).toHaveLength(1);
    expect(out.problems[0]).toMatch(/invalid JSON/);
  });

  it('a JSON value that is not an object gives one problem', () => {
    const out = load([1, 2]);
    expect(out.config).toEqual(DEFAULT_CONFIG);
    expect(out.problems).toEqual([expect.stringMatching(/expected a JSON object, got an array/)]);
  });

  it('an unknown key is reported and ignored', () => {
    const out = load({ maxAgeHours: 3, colour: 'red' });
    expect(out.config.maxAgeHours).toBe(3);
    expect(out.problems).toEqual(['colour: unknown key, ignored']);
  });

  it('reads a real file with the default reader', () => {
    const dir = mkdtempSync(join(tmpdir(), 'agent-office-config-'));
    try {
      const file = join(dir, 'config.json');
      writeFileSync(file, JSON.stringify({ maxAgeHours: 6 }));
      const out = loadConfig({ flag: file, env: {}, home: HOME });
      expect(out).toEqual({ config: { ...DEFAULT_CONFIG, maxAgeHours: 6 }, problems: [], path: file });
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it('the defaults are never shared with a loaded config', () => {
    load({}).config.projects.push('/home/user/code/x');
    expect(DEFAULT_CONFIG.projects).toEqual([]);
  });
});

describe('claudeConfigDir', () => {
  it('takes a string and expands ~', () => {
    expect(load({ claudeConfigDir: '~/.claude-work' }).config.claudeConfigDir).toBe('/home/user/.claude-work');
    expect(load({ claudeConfigDir: '/srv/claude' }).config.claudeConfigDir).toBe('/srv/claude');
    expect(load({ claudeConfigDir: null }).problems).toEqual([]);
  });

  it('a non-string falls back and names the key and type', () => {
    const out = load({ claudeConfigDir: 42 });
    expect(out.config.claudeConfigDir).toBeNull();
    expect(out.problems).toEqual(['claudeConfigDir: expected a non-empty string or null, got 42; using the default']);
  });
});

describe('maxAgeHours', () => {
  it('takes a number greater than 0', () => {
    const out = load({ maxAgeHours: 0.5 });
    expect(out.config.maxAgeHours).toBe(0.5);
    expect(out.problems).toEqual([]);
  });

  it.each([0, -1, '12', null])('%j falls back and names the key and type', (value) => {
    const out = load({ maxAgeHours: value });
    expect(out.config.maxAgeHours).toBe(MAX_AGE_HOURS);
    expect(out.problems).toEqual([expect.stringMatching(/^maxAgeHours: expected a number greater than 0, got /)]);
  });
});

describe('projects', () => {
  it('takes strings and expands ~', () => {
    const out = load({ projects: ['~/code/x', '/srv/y', '~'] });
    expect(out.config.projects).toEqual(['/home/user/code/x', '/srv/y', '/home/user']);
    expect(out.problems).toEqual([]);
  });

  it.each(['~/code/x', [1], { a: 1 }, ['']])('%j falls back and names the key and type', (value) => {
    const out = load({ projects: value });
    expect(out.config.projects).toEqual([]);
    expect(out.problems).toEqual([expect.stringMatching(/^projects: expected an array of non-empty strings, got /)]);
  });
});

describe('exclude', () => {
  it('takes globs and expands ~', () => {
    const out = load({ exclude: ['~/code/secret/**', '**/vendor/**'] });
    expect(out.config.exclude).toEqual(['/home/user/code/secret/**', '**/vendor/**']);
    expect(out.problems).toEqual([]);
  });

  it('a non-array falls back and names the key and type', () => {
    const out = load({ exclude: '**/vendor/**' });
    expect(out.config.exclude).toEqual([]);
    expect(out.problems).toEqual(['exclude: expected an array of non-empty strings, got "**/vendor/**"; using the default']);
  });
});

describe('detailMode', () => {
  it('false is accepted silently', () => {
    const out = load({ detailMode: false });
    expect(out.config.detailMode).toBe(false);
    expect(out.problems).toEqual([]);
  });

  it('true stays off with the G3 problem', () => {
    const out = load({ detailMode: true });
    expect(out.config.detailMode).toBe(false);
    expect(out.problems).toEqual(['detailMode: detailMode is off until the privacy check (G3) is answered']);
  });

  it('a non-boolean falls back and names the key and type', () => {
    const out = load({ detailMode: 'yes' });
    expect(out.config.detailMode).toBe(false);
    expect(out.problems).toEqual(['detailMode: expected a boolean, got "yes"; using the default']);
  });
});

describe('several problems', () => {
  it('reports one per bad key and keeps the good ones', () => {
    const out = load({ maxAgeHours: 'x', projects: ['~/code/x'], exclude: 3, extra: 1 });
    expect(out.config).toEqual({ ...DEFAULT_CONFIG, projects: ['/home/user/code/x'] });
    expect(out.problems).toHaveLength(3);
  });
});
