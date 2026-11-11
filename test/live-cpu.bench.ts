// Live CPU bench (plan step 9.5, DATA-5 done-when, research R14). Not part of `make test`: the
// Vitest include only matches `*.bench.ts` with BENCH=1, and the suite skips without it (the
// SPRITE_PNG pattern of test/sprite-preview.test.ts). Run it with `make bench-live`.
// It writes 20 synthetic transcripts of 10 MB each under var/bench/config/projects/, starts the
// live source on that config dir, appends one line per second to 5 of them for 30 s and prints
// the CPU share (process.cpuUsage over wall time, after start-up) and the RSS. Fails above 5 %.
// var/bench/ is removed afterwards. Nothing here reads the real config dir.
import { appendFileSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterAll, describe, expect, it } from 'vitest';
import { jsonl, Transcript, type Json } from '../fixtures/gen/records.js';
import { syntheticUuid } from '../fixtures/gen/sample.js';
import { slug } from '../fixtures/gen/transcripts.js';
import { createLiveSource, type LiveSource } from '../src/server/live/source.js';

const BENCH_DIR = fileURLToPath(new URL('../var/bench/', import.meta.url));
const CFG_DIR = join(BENCH_DIR, 'config');
const FILES = 20;
const FILE_BYTES = 10 * 1024 * 1024;
const APPENDED_FILES = 5;
const SECONDS = 30;
const MAX_CPU_PERCENT = 5;
const MB = 1024 * 1024;

interface BenchFile {
  path: string;
  t: Transcript;
}

/** One turn: prompt, a Read call and its result, an answer with usage (~1.5 KB). */
function turn(t: Transcript, n: number): Json[] {
  const { rec, call } = t.toolUse('Read', { file_path: `/home/dev/code/bench/src/module-${String(n % 97)}.ts` }, 20_000 + (n % 50) * 100);
  return [
    t.prompt(`Step ${String(n)}: read the module and summarise what it exports.`),
    rec,
    t.toolResult(call, `export const value${String(n)} = ${String(n)};\n`.repeat(8)),
    t.assistantText('end_turn', 21_000 + (n % 50) * 100, `Module ${String(n % 97)} exports one constant.`),
  ];
}

/** Writes one ~10 MB transcript in 1 MB chunks. */
function writeTranscript(i: number): BenchFile {
  const cwd = `/home/dev/code/bench-${String(i % 4)}`;
  const sessionId = syntheticUuid(`bench:${String(i)}`);
  const t = new Transcript({ seed: `bench:${String(i)}`, sessionId, cwd });
  const dir = join(CFG_DIR, 'projects', slug(cwd));
  mkdirSync(dir, { recursive: true });
  const path = join(dir, `${sessionId}.jsonl`);
  writeFileSync(path, '');
  let size = 0;
  let n = 0;
  while (size < FILE_BYTES) {
    let chunk = '';
    while (chunk.length < MB && size + chunk.length < FILE_BYTES) chunk += jsonl(turn(t, n++));
    appendFileSync(path, chunk);
    size += Buffer.byteLength(chunk);
  }
  return { path, t };
}

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
    const files = Array.from({ length: FILES }, (_, i) => writeTranscript(i));
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
