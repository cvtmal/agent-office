// The config file (RUN-2, research R10): `--config <file>`, else
// `$XDG_CONFIG_HOME/agent-office/config.json`, else `~/.config/agent-office/config.json`.
// Read-only. Every problem is reported and the affected key falls back to its default.
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { MAX_AGE_HOURS } from '../../shared/constants.js';

export interface Config {
  /** Overrides `CLAUDE_CONFIG_DIR` when set (`~` expanded); null: `CLAUDE_CONFIG_DIR`, else `~/.claude`. */
  claudeConfigDir: string | null;
  /** Sessions older than this many hours are not shown. */
  maxAgeHours: number;
  /** Repository roots to show (`~` expanded); empty: all. */
  projects: string[];
  /** Globs matched against project ids and character working directories (`~` expanded). */
  exclude: string[];
  /** Stays off until the privacy check (G3) is answered. */
  detailMode: false;
}

export const DEFAULT_CONFIG: Readonly<Config> = Object.freeze({
  claudeConfigDir: null,
  maxAgeHours: MAX_AGE_HOURS,
  projects: [],
  exclude: [],
  detailMode: false,
});

export interface ConfigInput {
  /** The `--config` flag, when given. */
  flag?: string | undefined;
  env: Readonly<Record<string, string | undefined>>;
  home: string;
}

export interface LoadedConfig {
  config: Config;
  /** One message per problem, without a prefix. */
  problems: string[];
  /** The file that was (or would have been) read. */
  path: string;
}

/** The config file path: the flag, else `$XDG_CONFIG_HOME/agent-office/config.json`, else `~/.config/...`. */
export function configPath({ flag, env, home }: ConfigInput): string {
  if (flag !== undefined) return flag;
  const xdg = env['XDG_CONFIG_HOME'];
  return join(xdg ? xdg : join(home, '.config'), 'agent-office', 'config.json');
}

/** Expands a leading `~` or `~/` with `home`. */
function expandHome(path: string, home: string): string {
  if (path === '~') return home;
  if (path.startsWith('~/')) return join(home, path.slice(2));
  return path;
}

function describe(value: unknown): string {
  if (value === null) return 'null';
  if (Array.isArray(value)) return 'an array';
  if (typeof value === 'string') return JSON.stringify(value);
  if (typeof value === 'number' || typeof value === 'boolean') return String(value);
  return `a ${typeof value}`;
}

function isStringList(value: unknown): value is string[] {
  return Array.isArray(value) && value.every((item) => typeof item === 'string' && item !== '');
}

function errorCode(error: unknown): string | undefined {
  return error instanceof Error && 'code' in error && typeof error.code === 'string' ? error.code : undefined;
}

/**
 * Reads and checks the config file. A missing default file gives the defaults and no problem;
 * a missing `--config` file, invalid JSON or a bad key gives one problem each.
 */
export function loadConfig({
  flag,
  env,
  home,
  read = (path) => readFileSync(path, 'utf8'),
}: ConfigInput & { read?: (path: string) => string }): LoadedConfig {
  const path = configPath({ flag, env, home });
  const config: Config = { ...DEFAULT_CONFIG, projects: [], exclude: [] };
  const problems: string[] = [];

  let text: string;
  try {
    text = read(path);
  } catch (error) {
    if (errorCode(error) === 'ENOENT') {
      if (flag !== undefined) problems.push(`${path}: file not found, using the defaults`);
    } else {
      problems.push(`${path}: cannot be read (${errorCode(error) ?? String(error)}), using the defaults`);
    }
    return { config, problems, path };
  }

  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch (error) {
    const reason = error instanceof Error ? error.message : String(error);
    problems.push(`${path}: invalid JSON (${reason}), using the defaults`);
    return { config, problems, path };
  }
  if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) {
    problems.push(`${path}: expected a JSON object, got ${describe(raw)}, using the defaults`);
    return { config, problems, path };
  }

  for (const [key, value] of Object.entries(raw)) {
    const bad = (expected: string): void => {
      problems.push(`${key}: expected ${expected}, got ${describe(value)}; using the default`);
    };
    switch (key) {
      case 'claudeConfigDir':
        if (value === null) config.claudeConfigDir = null;
        else if (typeof value === 'string' && value !== '') config.claudeConfigDir = expandHome(value, home);
        else bad('a non-empty string or null');
        break;
      case 'maxAgeHours':
        if (typeof value === 'number' && Number.isFinite(value) && value > 0) config.maxAgeHours = value;
        else bad('a number greater than 0');
        break;
      case 'projects':
      case 'exclude':
        if (isStringList(value)) config[key] = value.map((item) => expandHome(item, home));
        else bad('an array of non-empty strings');
        break;
      case 'detailMode':
        if (value === true) problems.push('detailMode: detailMode is off until the privacy check (G3) is answered');
        else if (value !== false) bad('a boolean');
        break;
      default:
        problems.push(`${key}: unknown key, ignored`);
    }
  }
  return { config, problems, path };
}
