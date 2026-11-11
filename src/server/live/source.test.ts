// Real timers and the real watcher: an append must reach a listener within DATA-5's 2 s.
import { appendFileSync, cpSync, mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import sampleJson from '../../../fixtures/snapshots/sample.json' with { type: 'json' };
import { syntheticUuid } from '../../../fixtures/gen/sample.js';
import type { ServerEvent, Snapshot } from '../../shared/types.js';
import { listTranscripts } from '../discovery/files.js';
import { repoRoot } from '../discovery/repo-root.js';
import { ThresholdEnvError } from '../reader/tokens.js';
import { createLiveSource, staticSource } from './source.js';

const CONFIG = fileURLToPath(new URL('../../../fixtures/transcripts/config/', import.meta.url));
const FAKE_GIT = new Set(['/home/dev/code/alpha/.git', '/home/dev/code/beta/.git']);
const rootOf = (cwd: string): string => repoRoot(cwd, (p) => FAKE_GIT.has(p));
const OPTS = {
  home: '/home/dev',
  pollMs: 1000,
  // no `ps`: an empty table, so no fixture pid counts as alive
  readTable: async () => new Map(),
  rootOf,
  harness: { read: () => null, watch: () => ({ close: () => undefined }) },
};

let base: string;
let n = 0;

function copy(): string {
  const dir = join(base, `c${n++}`);
  cpSync(CONFIG, dir, { recursive: true });
  return dir;
}

/** Active handles by type (timers, watchers, sockets, child processes). */
function handles(): Record<string, number> {
  const counts: Record<string, number> = {};
  for (const type of process.getActiveResourcesInfo()) counts[type] = (counts[type] ?? 0) + 1;
  return counts;
}

beforeAll(() => {
  base = mkdtempSync(join(tmpdir(), 'ao-source-'));
});

afterAll(() => {
  rmSync(base, { recursive: true, force: true });
});

describe('staticSource', () => {
  it('serves its snapshot and never sends a delta', async () => {
    const snapshot = sampleJson as Snapshot;
    const source = staticSource(snapshot);
    const listener = vi.fn();
    const off = source.subscribe(listener);
    expect(source.getSnapshot()).toBe(snapshot);
    off();
    await source.close();
    expect(listener).not.toHaveBeenCalled();
  });
});

describe('createLiveSource', () => {
  it(
    'delivers a delta within 2 s of an append, and close() leaves no handle open',
    async () => {
      const before = handles();
      const dir = copy();
      const source = await createLiveSource({ ...OPTS, env: { CLAUDE_CONFIG_DIR: dir } });
      expect(source.getSnapshot().characters.length).toBeGreaterThan(0);
      const id = syntheticUuid('cto');
      const path = listTranscripts({ cfgDir: dir, cutoffMs: -Infinity, isLive: () => true }).sessions.find((s) => s.sessionId === id)?.path;
      if (!path) throw new Error('fixture file not found');

      const received: ServerEvent[] = [];
      source.subscribe((events) => received.push(...events));
      const at = new Date().toISOString();
      const started = Date.now();
      appendFileSync(
        path,
        JSON.stringify({
          type: 'assistant',
          sessionId: id,
          cwd: '/home/dev/code/alpha',
          isSidechain: false,
          timestamp: at,
          message: {
            role: 'assistant',
            content: [{ type: 'tool_use', id: 'toolu_live', name: 'Read', input: { file_path: '/home/dev/code/alpha/live.ts' } }],
            stop_reason: 'tool_use',
          },
        }) + '\n',
      );
      await vi.waitFor(() => expect(received.some((e) => e.type === 'activity' && e.data.at === at)).toBe(true), {
        timeout: 2000,
        interval: 20,
      });
      expect(Date.now() - started).toBeLessThan(2000);
      expect(source.getSnapshot().activities.some((a) => a.at === at)).toBe(true);

      await source.close();
      // let closed watchers and handles finish tearing down
      await new Promise((resolve) => setImmediate(resolve));
      const after = handles();
      for (const [type, count] of Object.entries(after)) expect(count, type).toBeLessThanOrEqual(before[type] ?? 0);
      // unref'd timers and watchers are not listed above: prove they stopped (no event after a poll period)
      const count = received.length;
      appendFileSync(path, JSON.stringify({ type: 'user', sessionId: id, timestamp: new Date().toISOString() }) + '\n');
      await new Promise((resolve) => setTimeout(resolve, OPTS.pollMs + 300));
      expect(received.length).toBe(count);
    },
    10_000,
  );

  it('rejects on a bad threshold variable', async () => {
    const dir = copy();
    await expect(createLiveSource({ ...OPTS, env: { CLAUDE_CONFIG_DIR: dir, HARNESS_CTO_WARN: '1e5' } })).rejects.toBeInstanceOf(ThresholdEnvError);
  });

  it('reads the config dir from the config before the environment', async () => {
    const dir = copy();
    const source = await createLiveSource({ ...OPTS, env: { CLAUDE_CONFIG_DIR: join(base, 'missing') }, config: { claudeConfigDir: dir } });
    expect(source.getSnapshot().characters.length).toBeGreaterThan(0);
    await source.close();
  });
});
