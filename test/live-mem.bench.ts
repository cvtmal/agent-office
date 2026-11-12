// Footprint bench (RUN-3, #7 plan step 1.2). Not part of `make test`: it runs only with BENCH=1
// (`make bench-mem`, which builds first). It writes the same 20 x 10 MB synthetic set as
// live-cpu.bench.ts under var/bench-mem/, starts the *built* server through bin/agent-office (the
// real launch path, with its V8 flags) on it with HOME pointed into var/bench-mem/ (nothing real is read), times spawn -> URL line
// (start-up), lets it settle, samples `ps -o rss=` and asserts start-up < 2 s and RSS < 150 MB.
// var/bench-mem/ is removed afterwards.
import { rmSync } from 'node:fs';
import type { ChildProcess } from 'node:child_process';
import { afterAll, describe, expect, it } from 'vitest';
import { BENCH_DIR, FILES, PORT, prepareBenchDir, rssMb, sleep, startServer } from './bench-server.js';

const SETTLE_MS = 10_000;
const MAX_START_MS = 2000;
const MAX_RSS_MB = 150;

describe.skipIf(!process.env['BENCH'])('built server footprint (bench)', () => {
  let child: ChildProcess | null = null;

  afterAll(() => {
    child?.kill();
    rmSync(BENCH_DIR, { recursive: true, force: true });
  });

  it(`starts in < 2 s and stays under ${String(MAX_RSS_MB)} MB RSS with ${String(FILES)} x 10 MB transcripts`, async () => {
    prepareBenchDir();
    const started = await startServer();
    child = started.child;
    await sleep(SETTLE_MS);
    const pid = child.pid ?? 0;
    let rss = 0;
    for (let i = 0; i < 3; i++) {
      rss = Math.max(rss, rssMb(pid));
      await sleep(1000);
    }
    const snapshot = (await (await fetch(`http://localhost:${PORT}/api/snapshot`)).json()) as { characters: unknown[] };
    console.log(`live-mem: start-up ${(started.ms / 1000).toFixed(2)} s, RSS ${rss.toFixed(0)} MB, ${String(snapshot.characters.length)} characters`);
    expect(snapshot.characters.length).toBe(FILES);
    expect(started.ms).toBeLessThan(MAX_START_MS);
    expect(rss).toBeLessThan(MAX_RSS_MB);
  }, 300_000);
});
