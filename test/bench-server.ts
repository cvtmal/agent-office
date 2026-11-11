// Helpers for test/live-mem.bench.ts (and scratch heap checks): the bench dir under var/bench-mem/,
// the synthetic set and config file in it, and the built server started on it with HOME redirected.
import { spawn, execFileSync, type ChildProcess } from 'node:child_process';
import { mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { writeBenchSet } from './bench-set.js';

const ROOT = fileURLToPath(new URL('../', import.meta.url));
export const BENCH_DIR = join(ROOT, 'var', 'bench-mem');
const CFG_DIR = join(BENCH_DIR, 'config');
const HOME = join(BENCH_DIR, 'home');
const CONFIG_FILE = join(BENCH_DIR, 'config.json');
const CLI = join(ROOT, 'dist', 'node', 'server', 'cli.js');
export const PORT = process.env['HARNESS_PORT'] ?? '8001';
export const FILES = 20;

export const sleep = (ms: number): Promise<void> => new Promise((resolve) => setTimeout(resolve, ms));

/** Resident set size of `pid` in MB, from `ps -o rss=` (kilobytes). */
export function rssMb(pid: number): number {
  return Number(execFileSync('ps', ['-o', 'rss=', '-p', String(pid)], { encoding: 'utf8' }).trim()) / 1024;
}

/** Spawns the built server and resolves with the child and the ms until its URL line. */
export function startServer(extraArgs: string[] = [], nodeArgs: string[] = []): Promise<{ child: ChildProcess; ms: number }> {
  const t0 = performance.now();
  const child = spawn(process.execPath, [...nodeArgs, CLI, '--port', PORT, '--config', CONFIG_FILE, ...extraArgs], {
    cwd: BENCH_DIR,
    env: { PATH: process.env['PATH'] ?? '', HOME, XDG_CONFIG_HOME: join(HOME, '.config') },
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  return new Promise((resolve, reject) => {
    let out = '';
    child.stdout?.on('data', (d: Buffer) => {
      out += d.toString();
      if (out.includes('Agent Office: http')) resolve({ child, ms: performance.now() - t0 });
    });
    child.stderr?.on('data', (d: Buffer) => process.stderr.write(d));
    child.on('exit', (code) => reject(new Error(`server exited (${String(code)}) before its URL line`)));
  });
}

/** Writes the synthetic set and the config file pointing at it. */
export function prepareBenchDir(): void {
  rmSync(BENCH_DIR, { recursive: true, force: true });
  mkdirSync(join(CFG_DIR, 'sessions'), { recursive: true });
  mkdirSync(HOME, { recursive: true });
  writeBenchSet(CFG_DIR, FILES);
  writeFileSync(CONFIG_FILE, JSON.stringify({ claudeConfigDir: CFG_DIR }));
}

