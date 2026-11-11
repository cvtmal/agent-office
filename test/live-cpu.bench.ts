// Live CPU bench (plan step 9.5, DATA-5 done-when, research R14). Not part of `make test`: the
// Vitest include only matches `*.bench.ts` with BENCH=1, and the suite skips without it (the
// SPRITE_PNG pattern of test/sprite-preview.test.ts). Run it with `make bench-live`.
// It writes 20 synthetic transcripts of 10 MB each under var/bench/config/projects/, starts the
// live source on that config dir, appends one line per second to 5 of them for 30 s and prints
// the CPU share (process.cpuUsage over wall time, after start-up) and the RSS. Fails above 5 %.
// var/bench/ is removed afterwards. Nothing here reads the real config dir.
import { appendFileSync, mkdirSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterAll, describe, expect, it } from 'vitest';
import { jsonl } from '../fixtures/gen/records.js';
import { createLiveSource, type LiveSource } from '../src/server/live/source.js';
import { MB, writeBenchSet } from './bench-set.js';

const BENCH_DIR = fileURLToPath(new URL('../var/bench/', import.meta.url));
const CFG_DIR = join(BENCH_DIR, 'config');
const FILES = 20;
const APPENDED_FILES = 5;
const SECONDS = 30;
const MAX_CPU_PERCENT = 5;

const sleep = (ms: number): Promise<void> => new Promise((resolve) => setTimeout(resolve, ms));

describe.skipIf(!process.env['BENCH'])('live source CPU (bench)', () => {
  let source: LiveSource | null = null;

  afterAll(async () => {
    await source?.close();
    rmSync(BENCH_DIR, { recursive: true, force: true });
  });

  it(`stays under ${String(MAX_CPU_PERCENT)} % CPU with ${String(FILES)} x 10 MB transcripts and ${String(APPENDED_FILES)} growing`, async () => {
    rmSync(BENCH_DIR, { recursive: true, force: true });
    mkdirSync(join(CFG_DIR, 'sessions'), { recursive: true });
    const genStart = performance.now();
    const files = writeBenchSet(CFG_DIR, FILES);
    const genMs = performance.now() - genStart;

    const startAt = performance.now();
    source = await createLiveSource({ env: { CLAUDE_CONFIG_DIR: CFG_DIR }, home: '/home/dev', config: {} });
    const startMs = performance.now() - startAt;
    const characters = source.getSnapshot().characters.length;
    let batches = 0;
    source.subscribe(() => batches++);

    const cpu0 = process.cpuUsage();
    const wall0 = performance.now();
    for (let s = 0; s < SECONDS; s++) {
      for (const f of files.slice(0, APPENDED_FILES)) {
        appendFileSync(f.path, jsonl([f.t.assistantText(null, 30_000 + s * 10, `Still working, step ${String(s)}.`)]));
      }
      await sleep(1000);
    }
    const wallMs = performance.now() - wall0;
    const cpu = process.cpuUsage(cpu0);
    const cpuPercent = ((cpu.user + cpu.system) / 1000 / wallMs) * 100;
    const rss = process.memoryUsage().rss / MB;

    console.log(
      [
        `live-cpu: ${String(FILES)} x 10 MB transcripts (written in ${(genMs / 1000).toFixed(1)} s), ${String(characters)} characters`,
        `live-cpu: start-up ${(startMs / 1000).toFixed(2)} s; ${String(batches)} event batches in ${(wallMs / 1000).toFixed(1)} s`,
        `live-cpu: CPU ${cpuPercent.toFixed(2)} % (user ${(cpu.user / 1000).toFixed(0)} ms, system ${(cpu.system / 1000).toFixed(0)} ms), RSS ${rss.toFixed(0)} MB`,
      ].join('\n'),
    );
    expect(characters).toBe(FILES);
    expect(batches).toBeGreaterThan(0);
    expect(cpuPercent).toBeLessThan(MAX_CPU_PERCENT);
  }, 300_000);
});
