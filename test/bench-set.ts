// Shared synthetic transcript set for the live benches (test/live-cpu.bench.ts,
// test/live-mem.bench.ts): `files` transcripts of ~`bytes` each under <configDir>/projects/.
// Synthetic only; nothing here reads the real config dir.
import { appendFileSync, mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { jsonl, Transcript, type Json } from '../fixtures/gen/records.js';
import { syntheticUuid } from '../fixtures/gen/sample.js';
import { slug } from '../fixtures/gen/transcripts.js';

export const MB = 1024 * 1024;

export interface BenchFile {
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

/** Writes one ~`bytes` transcript in 1 MB chunks. */
function writeTranscript(configDir: string, i: number, bytes: number): BenchFile {
  const cwd = `/home/dev/code/bench-${String(i % 4)}`;
  const sessionId = syntheticUuid(`bench:${String(i)}`);
  const t = new Transcript({ seed: `bench:${String(i)}`, sessionId, cwd });
  const dir = join(configDir, 'projects', slug(cwd));
  mkdirSync(dir, { recursive: true });
  const path = join(dir, `${sessionId}.jsonl`);
  writeFileSync(path, '');
  let size = 0;
  let n = 0;
  while (size < bytes) {
    let chunk = '';
    while (chunk.length < MB && size + chunk.length < bytes) chunk += jsonl(turn(t, n++));
    appendFileSync(path, chunk);
    size += Buffer.byteLength(chunk);
  }
  return { path, t };
}

/** Writes the bench set (default 20 x 10 MB) under `configDir`/projects/. */
export function writeBenchSet(configDir: string, files = 20, bytes = 10 * MB): BenchFile[] {
  return Array.from({ length: files }, (_, i) => writeTranscript(configDir, i, bytes));
}
