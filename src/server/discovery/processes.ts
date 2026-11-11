// The process table: one `ps` per scan serves the pid-reuse guard and the teammate
// scan (research D3, decision P4; ctx:203-232).
import { execFile, execFileSync } from 'node:child_process';
import { promisify } from 'node:util';

export interface ProcessRow {
  pid: number;
  /** Process start, epoch seconds (UTC); null when `lstart` is unparsable. */
  startedAt: number | null;
  command: string;
}

const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

/** Parses `ps -o lstart` text (`%a %b %d %H:%M:%S %Y`, C locale) read as UTC, to epoch seconds. */
export function parseLstart(text: string): number | null {
  const tokens = text.trim().split(/\s+/);
  if (tokens.length !== 5) return null;
  const [weekday, monthName, dayText, clock, yearText] = tokens as [string, string, string, string, string];
  if (!WEEKDAYS.includes(weekday)) return null;
  const month = MONTHS.indexOf(monthName);
  if (month < 0) return null;
  if (!/^\d{1,2}$/.test(dayText) || !/^\d{4}$/.test(yearText)) return null;
  const time = /^(\d{1,2}):(\d{2}):(\d{2})$/.exec(clock);
  if (!time) return null;
  const day = Number(dayText);
  const hour = Number(time[1]);
  const minute = Number(time[2]);
  const second = Number(time[3]);
  if (day < 1 || day > 31 || hour > 23 || minute > 59 || second > 61) return null;
  return Date.UTC(Number(yearText), month, day, hour, minute, second) / 1000;
}

const PS_LINE = /^\s*(\d+)\s+(\S+\s+\S+\s+\S+\s+\S+\s+\S+)(?:\s+(.*))?$/;

/** Parses `ps -axo pid=,lstart=,command=` output: pid, five `lstart` tokens, the rest is the command. */
export function parsePsOutput(text: string): ProcessRow[] {
  const rows: ProcessRow[] = [];
  for (const line of text.split('\n')) {
    const match = PS_LINE.exec(line);
    if (!match) continue;
    rows.push({
      pid: Number(match[1]),
      startedAt: parseLstart(match[2] ?? ''),
      command: (match[3] ?? '').trimEnd(),
    });
  }
  return rows;
}

const PS_ARGS = ['-axo', 'pid=,lstart=,command='];
const PS_TIMEOUT_MS = 3000;
const PS_MAX_BUFFER = 32 * 1024 * 1024;
const psEnv = (): NodeJS.ProcessEnv => ({ ...process.env, LC_ALL: 'C', TZ: 'UTC' });
const execFileAsync = promisify(execFile);

/** Runs `ps` once; any failure → `null` (callers fall back to `kill(pid, 0)`). */
export function readProcessTable(): Map<number, ProcessRow> | null {
  try {
    const out = execFileSync('ps', PS_ARGS, {
      encoding: 'utf8',
      env: psEnv(),
      timeout: PS_TIMEOUT_MS,
      maxBuffer: PS_MAX_BUFFER,
      stdio: ['ignore', 'pipe', 'ignore'],
    });
    return new Map(parsePsOutput(out).map((row) => [row.pid, row]));
  } catch {
    return null;
  }
}

/** `readProcessTable` without blocking the event loop (same args and timeout); any failure → `null`. */
export async function readProcessTableAsync(): Promise<Map<number, ProcessRow> | null> {
  try {
    const { stdout } = await execFileAsync('ps', PS_ARGS, {
      encoding: 'utf8',
      env: psEnv(),
      timeout: PS_TIMEOUT_MS,
      maxBuffer: PS_MAX_BUFFER,
    });
    return new Map(parsePsOutput(stdout).map((row) => [row.pid, row]));
  } catch {
    return null;
  }
}
