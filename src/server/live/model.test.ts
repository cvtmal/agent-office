import { appendFileSync, cpSync, mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { syntheticUuid } from '../../../fixtures/gen/sample.js';
import type { ServerEvent } from '../../shared/types.js';
import { validateEvent } from '../../shared/validate.js';
import { liveRegistry, parsePsOutput, repoRoot, teammateProcs, type TeammateProc } from '../discovery/index.js';
import { listTranscripts } from '../discovery/files.js';
import { thresholdsFromEnv } from '../reader/tokens.js';
import { scanSnapshot } from '../snapshot.js';
import { createLiveModel, type LiveModel } from './model.js';

const FIXTURES = new URL('../../../fixtures/transcripts/', import.meta.url);
const TABLE = new Map(parsePsOutput(readFileSync(new URL('ps.txt', FIXTURES), 'utf8')).map((row) => [row.pid, row]));
const FAKE_GIT = new Set(['/home/dev/code/alpha/.git', '/home/dev/code/beta/.git']);
const rootOf = (cwd: string): string => repoRoot(cwd, (p) => FAKE_GIT.has(p));
const HOME = '/home/dev';
const NOW = Date.parse('2026-01-01T06:00:00.000Z');

let base: string;
let n = 0;

/** A fresh copy of the fixture config dir (mtimes = now). */
function copy(): string {
  const dir = join(base, `c${n++}`);
  cpSync(fileURLToPath(new URL('config/', FIXTURES)), dir, { recursive: true });
  return dir;
}

function model(
  cfgDir: string,
  {
    now = () => NOW,
    maxAgeHours = Infinity,
    teammates = teammateProcs(TABLE),
    detailMode,
  }: { now?: () => number; maxAgeHours?: number; teammates?: TeammateProc[]; detailMode?: boolean } = {},
): { live: LiveModel; events: ServerEvent[][] } {
  const events: ServerEvent[][] = [];
  const live = createLiveModel({
    cfgDir,
    home: HOME,
    now,
    maxAgeHours,
    thresholds: thresholdsFromEnv({}),
    rootOf,
    harnessOf: () => null,
    ...(detailMode === undefined ? {} : { detailMode }),
    liveness: { registry: async () => liveRegistry(cfgDir, TABLE), teammates: async () => teammates },
    onEvents: (e) => {
      for (const event of e) expect(validateEvent(event)).toEqual([]);
      events.push(e);
    },
  });
  return { live, events };
}

const pathOf = (cfgDir: string, sessionId: string, agentId: string | null = null): string => {
  const { sessions, agents } = listTranscripts({ cfgDir, cutoffMs: -Infinity, isLive: () => true });
  const hit = agentId === null ? sessions.find((s) => s.sessionId === sessionId) : agents.find((a) => a.sessionId === sessionId && a.agentId === agentId);
  if (!hit) throw new Error('fixture file not found');
  return hit.path;
};

beforeAll(() => {
  base = mkdtempSync(join(tmpdir(), 'ao-model-'));
});

afterAll(() => {
  rmSync(base, { recursive: true, force: true });
});

describe('createLiveModel', () => {
  it('starts with the snapshot scanSnapshot gives for the same dir', async () => {
    const dir = copy();
    const { live, events } = model(dir);
    await live.start();
    const { snapshot } = scanSnapshot({
      env: { CLAUDE_CONFIG_DIR: dir },
      home: HOME,
      now: new Date(NOW),
      maxAgeHours: Infinity,
      table: TABLE,
      rootOf,
      harnessOf: () => null,
    });
    expect(snapshot.characters.length).toBeGreaterThan(0);
    expect(live.snapshot()).toEqual(snapshot);
    expect(events).toEqual([[{ type: 'snapshot', data: snapshot }]]);
    await live.close();
  });

  it('turns one appended tool call into one activity and the character delta', async () => {
    const dir = copy();
    const { live, events } = model(dir);
    await live.start();
    events.length = 0;
    const id = syntheticUuid('cto');
    const path = pathOf(dir, id);
    const at = '2026-01-01T05:59:00.000Z';
    const line = {
      type: 'assistant',
      sessionId: id,
      cwd: '/home/dev/code/alpha',
      isSidechain: false,
      timestamp: at,
      uuid: syntheticUuid('appended'),
      message: {
        role: 'assistant',
        content: [{ type: 'tool_use', id: 'toolu_appended', name: 'Read', input: { file_path: '/home/dev/code/alpha/new.ts' } }],
        stop_reason: 'tool_use',
      },
    };
    appendFileSync(path, JSON.stringify(line) + '\n');
    await live.ingest(new Set([path]));
    expect(events).toHaveLength(1);
    const batch = events[0] ?? [];
    const activities = batch.filter((e) => e.type === 'activity');
    expect(activities).toEqual([{ type: 'activity', data: expect.objectContaining({ characterId: id, at, tool: 'Read' }) }]);
    const character = batch.find((e) => e.type === 'character' && e.data.id === id);
    expect(character?.type === 'character' && character.data.lastActivityAt).toBe(at);
    expect(batch.every((e) => e.type !== 'snapshot')).toBe(true);
    await live.close();
  });

  it('detail mode: every activity carries its whole tool input; off: no detail key', async () => {
    const appended = (id: string): string =>
      JSON.stringify({
        type: 'assistant',
        sessionId: id,
        cwd: '/home/dev/code/alpha',
        isSidechain: false,
        timestamp: '2026-01-01T05:59:00.000Z',
        uuid: syntheticUuid('appended-detail'),
        message: {
          role: 'assistant',
          content: [{ type: 'tool_use', id: 'toolu_detail', name: 'Edit', input: { file_path: '/home/dev/code/alpha/a.ts', old_string: 'OLD', new_string: 'NEW' } }],
          stop_reason: 'tool_use',
        },
      }) + '\n';
    const id = syntheticUuid('cto');

    const onDir = copy();
    const on = model(onDir, { detailMode: true });
    await on.live.start();
    appendFileSync(pathOf(onDir, id), appended(id));
    await on.live.ingest(new Set([pathOf(onDir, id)]));
    const onActivities = on.live.snapshot().activities;
    expect(onActivities.length).toBeGreaterThan(0);
    expect(onActivities.every((a) => typeof a.detail === 'string')).toBe(true);
    expect(onActivities.find((a) => a.tool === 'Edit' && a.characterId === id)?.detail).toBe(
      '{"file_path":"/home/dev/code/alpha/a.ts","old_string":"OLD","new_string":"NEW"}',
    );
    await on.live.close();

    for (const detailMode of [false, undefined]) {
      const offDir = copy();
      const off = model(offDir, detailMode === undefined ? {} : { detailMode });
      await off.live.start();
      appendFileSync(pathOf(offDir, id), appended(id));
      await off.live.ingest(new Set([pathOf(offDir, id)]));
      const offActivities = off.live.snapshot().activities;
      expect(offActivities.length).toBe(onActivities.length);
      expect(offActivities.every((a) => !('detail' in a))).toBe(true);
      await off.live.close();
    }
  });

  it('sends one snapshot when a transcript is deleted', async () => {
    const dir = copy();
    const { live, events } = model(dir);
    await live.start();
    events.length = 0;
    const agent = live.snapshot().characters.find((c) => c.kind === 'agent');
    if (!agent?.agentId) throw new Error('fixture has no agent');
    const path = pathOf(dir, agent.sessionId, agent.agentId);
    rmSync(path);
    await live.ingest(new Set([path]));
    expect(events.map((batch) => batch.map((e) => e.type))).toEqual([['snapshot']]);
    expect(live.snapshot().characters.some((c) => c.id === agent.id)).toBe(false);
    await live.close();
  });

  it('ages ended files out on a liveness refresh, with one snapshot', async () => {
    const dir = copy();
    let clock = Date.now();
    const { live, events } = model(dir, { now: () => clock, maxAgeHours: 1 });
    await live.start();
    const before = live.snapshot().characters.length;
    events.length = 0;
    clock += 3 * 3600 * 1000;
    await live.refreshLiveness();
    expect(events.map((batch) => batch.map((e) => e.type))).toEqual([['snapshot']]);
    const after = live.snapshot().characters;
    expect(after.length).toBeLessThan(before);
    // live sessions stay, whatever their age: registry and the quiet teammate (P5)
    expect(after.map((c) => c.id)).toContain(syntheticUuid('cto'));
    expect(after.map((c) => c.id)).toContain(syntheticUuid('teammate'));
    await live.close();
  });

  it('admits a stale transcript whose teammate process runs (P5, R7)', async () => {
    const dir = copy();
    const later = (): number => Date.now() + 48 * 3600 * 1000;
    const quiet = model(dir, { now: later, maxAgeHours: 1 });
    await quiet.live.start();
    expect(quiet.live.snapshot().characters.find((c) => c.id === syntheticUuid('teammate'))?.status).toBeDefined();
    await quiet.live.close();
    const none = model(dir, { now: later, maxAgeHours: 1, teammates: [] });
    await none.live.start();
    expect(none.live.snapshot().characters.some((c) => c.id === syntheticUuid('teammate'))).toBe(false);
    await none.live.close();
  });

  it('admits a new transcript that appears under projects/', async () => {
    const dir = copy();
    const { live, events } = model(dir);
    await live.start();
    events.length = 0;
    const src = pathOf(dir, syntheticUuid('busy'));
    const id = syntheticUuid('appeared');
    const path = join(dir, 'projects', '-home-dev-code-alpha', `${id}.jsonl`);
    appendFileSync(path, readFileSync(src, 'utf8').replaceAll(syntheticUuid('busy'), id));
    await live.ingest(new Set([path]));
    expect(events.flat().some((e) => e.type === 'character' && e.data.id === id)).toBe(true);
    await live.close();
  });
});
