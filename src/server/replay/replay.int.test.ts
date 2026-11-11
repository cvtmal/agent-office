// The harness set played at speed 1000 through the real live source (DATA-9, D-016 c, D-020):
// its final characters equal the set read in one go, and the D-020 reveal reaches the stream as a
// `project` event. The copy goes to a temp root's var/.
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterAll, describe, expect, it, vi } from 'vitest';
import { readSet, REPLAY_DIR } from '../../../test/replay-set.js';
import type { Character, ServerEvent } from '../../shared/types.js';
import { readHarness } from '../harness/read.js';
import { watchHarness } from '../harness/watch.js';
import { createLiveSource, type LiveSource } from '../live/source.js';
import { startReplay, type Replay } from './player.js';

const root = mkdtempSync(join(tmpdir(), 'agent-office-replay-'));
let replay: Replay | null = null;
let source: LiveSource | null = null;

afterAll(async () => {
  await source?.close();
  replay?.close();
  rmSync(root, { recursive: true, force: true });
});

const brief = (cs: Character[]) =>
  cs.map((c) => ({ id: c.id, kind: c.kind, name: c.name, role: c.role, status: c.status, cwd: c.cwd })).sort((a, b) => (a.id < b.id ? -1 : 1));

describe('replay of the harness set through the live source', () => {
  it('ends with the characters of the set and emits the D-020 reveal', { timeout: 30_000 }, async () => {
    replay = startReplay({ dir: join(REPLAY_DIR, 'harness'), speed: 1000, root, log: () => undefined });
    const r = replay;
    const read = (dir: string) => readHarness(dir, { git: () => null });
    const received: { at: number; event: ServerEvent }[] = [];
    source = await createLiveSource({
      env: {},
      home: r.manifest.home,
      config: { maxAgeHours: Infinity },
      cfgDir: r.cfgDir,
      now: r.now,
      liveness: r.liveness,
      rootOf: r.rootOf,
      dirOf: r.dirOf,
      pollMs: 50,
      harness: { read, watch: (dir, onChange) => watchHarness(dir, onChange, { read, pollMs: 50 }) },
    });
    source.subscribe((events) => {
      for (const event of events) received.push({ at: r.now() - Date.parse(r.manifest.base), event });
    });
    await r.done;

    const expected = readSet('harness', { live: 'end' }).snapshot;
    const end = new Date(Date.parse(r.manifest.base) + r.manifest.durationMs).toISOString();
    await vi.waitFor(
      () => {
        const snapshot = source?.getSnapshot();
        expect(snapshot?.generatedAt).toBe(end); // the virtual clock drives generatedAt
        expect(brief(snapshot?.characters ?? [])).toEqual(brief(expected.characters));
      },
      { timeout: 5000, interval: 50 },
    );
    const final = source.getSnapshot();
    expect(final.projects.map((p) => [p.name, p.harness?.phase, p.harness?.outcomes.length])).toEqual([['harbor', 'W1 landing', 2]]);

    const revealAt = r.manifest.files.find((f) => f.as !== undefined)?.appearsAtMs ?? Infinity;
    const reveal = received.find(
      ({ event }) => event.type === 'project' && event.data.harness?.outcomes.length === 2 && event.data.harness.phase === 'W1 landing',
    );
    expect(reveal).toBeDefined();
    expect(reveal?.at).toBeGreaterThanOrEqual(revealAt);
    const before = received.filter(({ event }) => event.type === 'project' && event.data.harness?.phase === 'W1 building');
    expect(before.length).toBeGreaterThan(0);
  });
});
