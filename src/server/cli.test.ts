// The CLI as a child process (research R9, R10, R11): every exit-2 case, `--sample` on port 0 and
// a bad `--config` that is reported while the server still starts.
// HOME and CLAUDE_CONFIG_DIR point at an empty temp dir, so the real config dir is never read.
import { execFile, spawn } from 'node:child_process';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import type { Snapshot } from '../shared/types.js';

const REPO = fileURLToPath(new URL('../../', import.meta.url));
const CLI = fileURLToPath(new URL('./cli.ts', import.meta.url));
let home: string;

beforeAll(() => {
  home = mkdtempSync(join(tmpdir(), 'agent-office-cli-'));
});

afterAll(() => {
  rmSync(home, { recursive: true, force: true });
});

function env(extra: Record<string, string> = {}): NodeJS.ProcessEnv {
  return { PATH: process.env['PATH'], HOME: home, CLAUDE_CONFIG_DIR: join(home, '.claude'), ...extra };
}

function run(args: string[], extra?: Record<string, string>): Promise<{ code: number | null; stderr: string; stdout: string }> {
  return new Promise((resolve) => {
    execFile(process.execPath, ['--import', 'tsx', CLI, ...args], { cwd: REPO, env: env(extra), timeout: 20_000 }, (error, stdout, stderr) => {
      resolve({ code: error ? (typeof error.code === 'number' ? error.code : null) : 0, stdout, stderr });
    });
  });
}

describe('cli exit codes', () => {
  it.each([
    [['--speed', '2'], /--speed needs --replay/],
    [['--speed', '0', '--replay', 'x'], /--speed must be a number greater than 0/],
    [['--speed', 'fast', '--replay', 'x'], /--speed must be a number greater than 0/],
    [['--replay', 'x', '--sample'], /--replay and --sample cannot be combined/],
    [['--replay', 'no-such-set'], /Invalid replay set: .*manifest\.json: \(file\): cannot be read/],
    [['--port', 'nope'], /--port must be an integer/],
    [['--bogus'], /Unknown option/],
  ])('%j exits 2', { timeout: 20_000 }, async (args, message) => {
    const { code, stderr } = await run(args);
    expect(code).toBe(2);
    expect(stderr).toMatch(message);
  });

  it('a bad threshold variable exits 2 and names it', { timeout: 20_000 }, async () => {
    const { code, stderr } = await run(['--port', '0'], { HARNESS_CTO_WARN: '12k' });
    expect(code).toBe(2);
    expect(stderr).toContain('HARNESS_CTO_WARN');
  });

  it('--help lists every flag', { timeout: 20_000 }, async () => {
    const { code, stdout } = await run(['--help']);
    expect(code).toBe(0);
    for (const flag of ['--port', '--dev', '--open', '--sample', '--detail', '--config', '--replay', '--speed', '--help']) {
      expect(stdout).toContain(flag);
    }
  });
});

describe('cli --sample --port 0', () => {
  it('prints the real port and serves the sample', { timeout: 60_000 }, async () => {
    const child = spawn(process.execPath, ['--import', 'tsx', CLI, '--sample', '--port', '0'], { cwd: REPO, env: env() });
    const exited = new Promise<number | null>((resolve) => child.once('exit', (code) => resolve(code)));
    try {
      const url = await new Promise<string>((resolve, reject) => {
        let out = '';
        child.stdout.on('data', (chunk: Buffer) => {
          out += chunk.toString();
          const match = /Agent Office: (http:\/\/127\.0\.0\.1:(\d+)\/)/.exec(out);
          if (match?.[1] && match[2]) {
            expect(Number(match[2])).toBeGreaterThan(0);
            resolve(match[1]);
          }
        });
        child.once('exit', () => reject(new Error(`exited before listening:\n${out}`)));
      });
      const res = await fetch(new URL('/api/snapshot', url));
      expect(res.status).toBe(200);
      expect(((await res.json()) as Snapshot).characters).toHaveLength(26);
    } finally {
      child.kill('SIGTERM');
    }
    expect(await exited).toBe(0);
  });
});

describe('cli --replay', () => {
  it('plays a set on its virtual clock', { timeout: 60_000 }, async () => {
    const child = spawn(process.execPath, ['--import', 'tsx', CLI, '--replay', 'fixtures/replay/solo', '--speed', '1000', '--port', '0'], {
      cwd: REPO,
      env: env(),
    });
    const exited = new Promise<number | null>((resolve) => child.once('exit', (code) => resolve(code)));
    try {
      let out = '';
      const url = await new Promise<string>((resolve, reject) => {
        child.stdout.on('data', (chunk: Buffer) => {
          out += chunk.toString();
          const match = /Agent Office: (http:\/\/127\.0\.0\.1:\d+\/)/.exec(out);
          if (match?.[1]) resolve(match[1]);
        });
        child.once('exit', () => reject(new Error(`exited before listening:\n${out}`)));
      });
      await vi.waitFor(() => expect(out).toContain('replay finished'), { timeout: 10_000, interval: 50 });
      await vi.waitFor(
        async () => {
          const snapshot = (await (await fetch(new URL('/api/snapshot', url))).json()) as Snapshot;
          expect(snapshot.generatedAt).toBe('2026-01-01T00:10:00.000Z'); // base + durationMs
          expect(snapshot.characters.map((c) => c.cwd)).toEqual(['/home/dev/code/notes']);
        },
        { timeout: 10_000, interval: 100 },
      );
    } finally {
      child.kill('SIGTERM');
    }
    expect(await exited).toBe(0);
    rmSync(join(REPO, 'var', 'replay', `solo-${String(child.pid)}`), { recursive: true, force: true }); // the player's copy
  });
});

describe('cli --config', () => {
  it('prints every problem of a bad config and still starts', { timeout: 60_000 }, async () => {
    const file = join(home, 'bad-config.json');
    writeFileSync(file, JSON.stringify({ maxAgeHours: 'soon', detailMode: true, colour: 'red' }));
    const child = spawn(process.execPath, ['--import', 'tsx', CLI, '--config', file, '--port', '0'], { cwd: REPO, env: env() });
    const exited = new Promise<number | null>((resolve) => child.once('exit', (code) => resolve(code)));
    let stderr = '';
    child.stderr.on('data', (chunk: Buffer) => {
      stderr += chunk.toString();
    });
    try {
      const url = await new Promise<string>((resolve, reject) => {
        let out = '';
        child.stdout.on('data', (chunk: Buffer) => {
          out += chunk.toString();
          const match = /Agent Office: (http:\/\/127\.0\.0\.1:\d+\/)/.exec(out);
          if (match?.[1]) resolve(match[1]);
        });
        child.once('exit', () => reject(new Error(`exited before listening:\n${out}\n${stderr}`)));
      });
      const res = await fetch(new URL('/api/snapshot', url));
      expect(res.status).toBe(200);
      const lines = stderr.split('\n').filter((line) => line.startsWith('agent-office: config: '));
      expect(lines).toHaveLength(2);
      expect(stderr).toContain('agent-office: config: maxAgeHours: expected a number greater than 0');
      expect(stderr).toContain('agent-office: config: colour: unknown key');
    } finally {
      child.kill('SIGTERM');
    }
    expect(await exited).toBe(0);
  });

  it('reports a missing --config file and still starts', { timeout: 60_000 }, async () => {
    const child = spawn(process.execPath, ['--import', 'tsx', CLI, '--config', join(home, 'missing.json'), '--sample', '--port', '0'], {
      cwd: REPO,
      env: env(),
    });
    const exited = new Promise<number | null>((resolve) => child.once('exit', (code) => resolve(code)));
    let stderr = '';
    child.stderr.on('data', (chunk: Buffer) => {
      stderr += chunk.toString();
    });
    try {
      await new Promise<void>((resolve, reject) => {
        child.stdout.on('data', (chunk: Buffer) => {
          if (chunk.toString().includes('Agent Office: ')) resolve();
        });
        child.once('exit', () => reject(new Error(`exited before listening:\n${stderr}`)));
      });
      expect(stderr).toMatch(/agent-office: config: .*missing\.json: file not found/);
    } finally {
      child.kill('SIGTERM');
    }
    expect(await exited).toBe(0);
  });
});

/** Starts the CLI on port 0 with an empty HOME, waits until it listens, stops it and returns its whole stderr. */
async function stderrOfStart(args: string[]): Promise<string> {
  const child = spawn(process.execPath, ['--import', 'tsx', CLI, ...args, '--port', '0'], { cwd: REPO, env: env() });
  const closed = new Promise<number | null>((resolve) => child.once('close', (code) => resolve(code)));
  let stderr = '';
  child.stderr.on('data', (chunk: Buffer) => {
    stderr += chunk.toString();
  });
  try {
    const url = await new Promise<string>((resolve, reject) => {
      let out = '';
      child.stdout.on('data', (chunk: Buffer) => {
        out += chunk.toString();
        const match = /Agent Office: (http:\/\/127\.0\.0\.1:\d+\/)/.exec(out);
        if (match?.[1]) resolve(match[1]);
      });
      child.once('exit', () => reject(new Error(`exited before listening:\n${out}\n${stderr}`)));
    });
    // One request first: the CLI installs its SIGTERM handler after printing the URL.
    expect((await fetch(new URL('/api/snapshot', url))).status).toBe(200);
  } finally {
    child.kill('SIGTERM');
  }
  expect(await closed).toBe(0);
  return stderr;
}

describe('cli detail mode', () => {
  const WARNING = 'agent-office: detail mode is on: raw tool input is sent to the local browser.';
  const count = (text: string): number => text.split('\n').filter((line) => line === WARNING).length;

  it('--detail prints the warning once', { timeout: 60_000 }, async () => {
    expect(count(await stderrOfStart(['--detail']))).toBe(1);
  });

  it('config detailMode true prints the warning once, with no config problem', { timeout: 60_000 }, async () => {
    const file = join(home, 'detail-config.json');
    writeFileSync(file, JSON.stringify({ detailMode: true }));
    const stderr = await stderrOfStart(['--config', file]);
    expect(count(stderr)).toBe(1);
    expect(stderr).not.toContain('agent-office: config: ');
  });

  it('off prints nothing about detail mode', { timeout: 60_000 }, async () => {
    const file = join(home, 'off-config.json');
    writeFileSync(file, JSON.stringify({ detailMode: false }));
    expect(await stderrOfStart([])).not.toContain('detail mode');
    expect(await stderrOfStart(['--config', file])).not.toContain('detail mode');
  });
});
