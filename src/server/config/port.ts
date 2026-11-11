// Which port the server listens on. Pure: callers pass in the flag, the
// environment and the parsed .lane.env.
import { DEFAULT_PORT } from '../../shared/constants.js';

/** Parses `KEY=VALUE` lines; blank lines and `#` comments are skipped. */
export function parseLaneEnv(text: string): Record<string, string> {
  const out: Record<string, string> = {};
  for (const raw of text.split(/\r?\n/)) {
    const line = raw.trim();
    if (line === '' || line.startsWith('#')) continue;
    const eq = line.indexOf('=');
    if (eq <= 0) continue;
    out[line.slice(0, eq).trim()] = line.slice(eq + 1).trim();
  }
  return out;
}

export interface PortInput {
  flag?: string;
  env: Record<string, string | undefined>;
  laneEnv: Record<string, string>;
}

/** Order: `--port` > `PORT` > `HARNESS_PORT` (environment, then .lane.env) > DEFAULT_PORT. */
export function resolvePort(input: PortInput): { port: number } | { error: string } {
  const candidates: [string, string | undefined][] = [
    ['--port', input.flag],
    ['PORT', input.env['PORT']],
    ['HARNESS_PORT', input.env['HARNESS_PORT'] ?? input.laneEnv['HARNESS_PORT']],
  ];
  for (const [source, value] of candidates) {
    if (value === undefined || value === '') continue;
    const port = parsePort(value);
    if (port === null) return { error: `${source} must be an integer from 0 to 65535, got "${value}"` };
    return { port };
  }
  return { port: DEFAULT_PORT };
}

/** 0 is allowed so tests can ask the OS for a free port. */
function parsePort(value: string): number | null {
  const text = value.trim();
  if (!/^\d+$/.test(text)) return null;
  const n = Number(text);
  return n <= 65535 ? n : null;
}
