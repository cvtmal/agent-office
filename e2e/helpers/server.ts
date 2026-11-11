// Servers for the live e2e specs (plan step 9.1, P-5): each spec starts its own `bin/agent-office`
// on a free port (never 4477 or another lane's port), isolated from the real config: the Claude
// config dir is always a copy under var/e2e/ (or a path there that does not exist) and the config
// file is always a `--config` file under var/e2e/, so neither ~/.claude, $CLAUDE_CONFIG_DIR nor
// ~/.config/agent-office is ever read. Everything written stays under var/e2e/ (and the replay
// player's own copy under var/replay/) and is removed again.
import { spawn, type ChildProcess } from 'node:child_process';
import { cpSync, mkdirSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { createServer } from 'node:net';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = fileURLToPath(new URL('../../', import.meta.url));
const E2E_VAR = join(ROOT, 'var', 'e2e');
const REPLAY_VAR = join(ROOT, 'var', 'replay');
const BIN = join(ROOT, 'bin', 'agent-office');
const READY_TIMEOUT_MS = 60_000;
const STOP_TIMEOUT_MS = 10_000;

/** A port that was free a moment ago: a `net` server bound on port 0, read, closed. */
export function freePort(): Promise<number> {
  return new Promise((resolve, reject) => {
    const server = createServer();
    server.unref();
    server.once('error', reject);
    server.listen(0, '127.0.0.1', () => {
      const address = server.address();
      const port = typeof address === 'object' && address !== null ? address.port : 0;
      server.close(() => (port > 0 ? resolve(port) : reject(new Error('no port'))));
    });
  });
}

export interface Cli {
  url: string;
  port: number;
  /** Everything the server printed on stdout so far. */
  stdout(): string;
  /** SIGTERM, then waits for the process to exit (SIGKILL after 10 s). */
  stop(): Promise<void>;
}

function flagValue(args: readonly string[], flag: string): string | undefined {
  const i = args.indexOf(flag);
  return i >= 0 ? args[i + 1] : undefined;
}

let configFiles = 0;

/** An empty config file under var/e2e/ (removed by `stop()`), so the home config file is never read. */
function emptyConfigFile(): string {
  mkdirSync(E2E_VAR, { recursive: true });
  configFiles += 1;
  const file = join(E2E_VAR, `empty-config-${String(process.pid)}-${String(configFiles)}.json`);
  writeFileSync(file, '{}\n');
  return file;
}

/**
 * Spawns `bin/agent-office --dev` (the current source, not a stale dist/) and resolves once it
 * printed its URL. Adds `--port <freePort()>` and an empty `--config` file under var/e2e/ when
 * `args` has none, and sets `CLAUDE_CONFIG_DIR` to a path under var/e2e/ unless `env` sets it.
 */
export async function startCli(args: readonly string[], env: Readonly<Record<string, string>> = {}): Promise<Cli> {
  const full = [...args];
  if (!full.includes('--port')) full.push('--port', String(await freePort()));
  const ownConfig = full.includes('--config') ? null : emptyConfigFile();
  if (ownConfig !== null) full.push('--config', ownConfig);
  if (!full.includes('--dev')) full.push('--dev');
  const port = Number(flagValue(full, '--port'));

  const child: ChildProcess = spawn(BIN, full, {
    cwd: ROOT,
    env: { ...process.env, CLAUDE_CONFIG_DIR: join(E2E_VAR, 'no-config-dir'), ...env },
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  let out = '';
  let err = '';
  child.stdout?.setEncoding('utf8').on('data', (chunk: string) => (out += chunk));
  child.stderr?.setEncoding('utf8').on('data', (chunk: string) => (err += chunk));
  const exited = new Promise<void>((resolve) => child.once('exit', () => resolve()));

  const url = await new Promise<string>((resolve, reject) => {
    const timer = setTimeout(() => {
      child.kill('SIGKILL');
      reject(new Error(`agent-office did not print its URL within ${String(READY_TIMEOUT_MS)} ms\n${err}`));
    }, READY_TIMEOUT_MS);
    const check = (): void => {
      const match = /Agent Office: (http:\/\/\S+)/.exec(out);
      if (match?.[1] === undefined) return;
      clearTimeout(timer);
      child.stdout?.off('data', check);
      resolve(match[1]);
    };
    child.stdout?.on('data', check);
    child.once('exit', (code) => {
      clearTimeout(timer);
      reject(new Error(`agent-office exited (${String(code)}) before it was ready\n${err}`));
    });
  });

  return {
    url,
    port,
    stdout: () => out,
    async stop() {
      if (child.exitCode === null && child.signalCode === null) {
        child.kill('SIGTERM');
        const timer = setTimeout(() => child.kill('SIGKILL'), STOP_TIMEOUT_MS);
        await exited;
        clearTimeout(timer);
      }
      if (ownConfig !== null) rmSync(ownConfig, { force: true });
    },
  };
}

export interface TempConfig {
  /** var/e2e/<name>-<pid>/ */
  dir: string;
  /** The copy of fixtures/transcripts/config: the Claude config dir of the server. */
  cfgDir: string;
  /** An empty config file next to the copy, for `--config`. */
  configFile: string;
  /** `startCli` args and env that point the server at the copy. */
  args: string[];
  env: Record<string, string>;
  /** Removes the copy. */
  cleanup(): void;
}

/** Copies fixtures/transcripts/config to var/e2e/<name>-<pid>/config (fresh mtimes: the copy is "recent"). */
export function tempConfig(name: string): TempConfig {
  const dir = join(E2E_VAR, `${name}-${String(process.pid)}`);
  rmSync(dir, { recursive: true, force: true });
  const cfgDir = join(dir, 'config');
  cpSync(join(ROOT, 'fixtures', 'transcripts', 'config'), cfgDir, { recursive: true });
  const configFile = join(dir, 'config.json');
  writeFileSync(configFile, '{}\n');
  return {
    dir,
    cfgDir,
    configFile,
    args: ['--config', configFile],
    env: { CLAUDE_CONFIG_DIR: cfgDir },
    cleanup: () => rmSync(dir, { recursive: true, force: true }),
  };
}

/** `var/replay/<set>-<pid>` dirs (the player's copies, `replay/player.ts`), by name. */
export function replayCopies(set: string): Set<string> {
  try {
    return new Set(readdirSync(REPLAY_VAR).filter((name) => name.startsWith(`${set}-`)));
  } catch {
    return new Set();
  }
}

function alive(pid: number): boolean {
  try {
    process.kill(pid, 0);
    return true;
  } catch (error) {
    return (error as NodeJS.ErrnoException).code === 'EPERM';
  }
}

/** Removes the replay copies made since `before` whose server process has exited (the player keeps its copy). */
export function removeReplayCopies(set: string, before: ReadonlySet<string>): void {
  for (const name of replayCopies(set)) {
    const pid = Number(name.slice(set.length + 1));
    if (before.has(name) || !Number.isInteger(pid) || alive(pid)) continue;
    rmSync(join(REPLAY_VAR, name), { recursive: true, force: true });
  }
}
