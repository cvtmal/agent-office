// The player on the shipped sets with an injected real clock and speed 1000 (1 real ms = 1 virtual s).
// Copies go to a temp root's var/.
import { existsSync, mkdtempSync, readdirSync, readFileSync, rmSync, statSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterAll, afterEach, describe, expect, it, vi } from 'vitest';
import { startReplay, type Replay } from './player.js';

const SETS = fileURLToPath(new URL('../../../fixtures/replay/', import.meta.url));
const root = mkdtempSync(join(tmpdir(), 'agent-office-player-'));
let fake = 0;
const clock = (): number => fake;
let replay: Replay | null = null;

afterEach(() => {
  replay?.close();
  replay = null;
  fake = 0;
});

afterAll(() => {
  rmSync(root, { recursive: true, force: true });
});

/** Files under `dir`, relative, sorted. */
function filesUnder(dir: string): string[] {
  return readdirSync(dir, { recursive: true, withFileTypes: true })
    .filter((d) => d.isFile())
    .map((d) => relative(dir, join(d.parentPath, d.name)))
    .sort();
}

const copyOf = (r: Replay): string => join(r.cfgDir, '..');

describe('startReplay on solo', () => {
  it('grows the transcript over time and ends byte-equal to the set', async () => {
    const lines: string[] = [];
    const r = (replay = startReplay({ dir: join(SETS, 'solo'), speed: 1000, root, clock, log: (m) => lines.push(m) }));
    expect(r.now()).toBe(Date.parse(r.manifest.base));
    const [transcript] = filesUnder(join(SETS, 'solo', 'config'));
    const path = join(r.cfgDir, transcript ?? '');
    const sizes = [statSync(path).size];
    for (const ms of [60, 200, 400]) {
      fake = ms;
      await vi.waitFor(() => expect(statSync(path).size).toBeGreaterThan(sizes.at(-1) ?? 0), { timeout: 2000, interval: 10 });
      sizes.push(statSync(path).size);
    }
    fake = 10_000; // well past the end: the virtual clock stops at durationMs
    await r.done;
    expect(r.now()).toBe(Date.parse(r.manifest.base) + r.manifest.durationMs);
    expect(lines).toEqual(['replay finished']);
    const set = join(SETS, 'solo');
    expect(filesUnder(copyOf(r))).toEqual(filesUnder(set));
    for (const file of filesUnder(set)) expect(readFileSync(join(copyOf(r), file), 'utf8'), file).toBe(readFileSync(join(set, file), 'utf8'));
  });
});

describe('startReplay on harness', () => {
  const set = join(SETS, 'harness');

  it('registers the live windows active at the virtual time; no teammates', async () => {
    const r = (replay = startReplay({ dir: set, speed: 1000, root, clock, log: () => undefined }));
    const ids = r.manifest.live.map((w) => w.sessionId);
    const [cto, a, b, c] = ids;
    for (const [ms, expected] of [
      [10, [cto]],
      [100, [cto, a, b, c]],
      [500, [cto, b, c]],
    ] as const) {
      fake = ms;
      const registry = await r.liveness.registry();
      expect([...registry.keys()].sort(), `${String(ms)} s`).toEqual([...expected].sort());
      for (const entry of registry.values()) {
        expect(entry.pid).toBe(5000 + ids.indexOf(entry.sessionId));
        expect(entry.procStart).toBeNull();
      }
    }
    expect(await r.liveness.teammates()).toEqual([]);
  });

  it('maps roots to the copy and reveals files at appearsAtMs (STATE.landed.md replaces STATE.md)', async () => {
    const r = (replay = startReplay({ dir: set, speed: 1000, root, clock, log: () => undefined }));
    const repo = join(copyOf(r), 'repo');
    expect(r.rootOf('/home/dev/code/harbor/.claude/worktrees/theme-tokens')).toBe('/home/dev/code/harbor');
    expect(r.rootOf('/home/dev/code/harbor')).toBe('/home/dev/code/harbor');
    expect(r.rootOf('/home/dev/code/harbor-two')).toBe('/home/dev/code/harbor-two');
    expect(r.dirOf('/home/dev/code/harbor')).toBe(repo);
    expect(r.dirOf('/home/dev/code/elsewhere')).toBe('/home/dev/code/elsewhere');

    const state = join(repo, 'docs/harness/STATE.md');
    const outcome = join(repo, 'docs/outcomes/01-session-store.md');
    expect(readFileSync(state, 'utf8')).toContain('- Phase: W1 building');
    expect(existsSync(outcome)).toBe(false);
    const metas = filesUnder(r.cfgDir).filter((f) => f.endsWith('.meta.json'));
    expect(metas).toEqual([]);

    fake = 545;
    await vi.waitFor(() => expect(existsSync(outcome)).toBe(true), { timeout: 2000, interval: 10 });
    expect(readFileSync(state, 'utf8')).toContain('- Phase: W1 building');
    expect(filesUnder(r.cfgDir).filter((f) => f.endsWith('.meta.json'))).toHaveLength(2);

    fake = 10_000;
    await r.done;
    expect(readFileSync(state, 'utf8')).toBe(readFileSync(join(set, 'repo/docs/harness/STATE.landed.md'), 'utf8'));
    expect(existsSync(join(repo, 'docs/harness/STATE.landed.md'))).toBe(false);
    for (const file of filesUnder(join(set, 'config'))) {
      expect(readFileSync(join(r.cfgDir, file), 'utf8'), file).toBe(readFileSync(join(set, 'config', file), 'utf8'));
    }
  });

  it('rejects a bad speed', () => {
    expect(() => startReplay({ dir: set, speed: 0, root, clock })).toThrow(/speed/);
  });
});
