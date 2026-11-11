import { appendFileSync, mkdtempSync, renameSync, rmSync, truncateSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createTail } from './tail.js';

const line = (value: unknown): string => JSON.stringify(value) + '\n';

let base: string;
let n = 0;

function fresh(content = ''): string {
  const path = join(base, `t${n++}.jsonl`);
  writeFileSync(path, content);
  return path;
}

beforeAll(() => {
  base = mkdtempSync(join(tmpdir(), 'ao-tail-'));
});

afterAll(() => {
  rmSync(base, { recursive: true, force: true });
});

describe('createTail', () => {
  it('reads the whole file first, then only appended lines', async () => {
    const path = fresh(line({ type: 'user' }) + line({ type: 'assistant' }));
    const tail = createTail(path);
    const first = await tail.read();
    expect(first?.reset).toBe(false);
    expect(first?.chunk.records.map((r) => r.type)).toEqual(['user', 'assistant']);
    expect(await tail.read()).toBeNull();
    appendFileSync(path, line({ type: 'system' }));
    const second = await tail.read();
    expect(second?.chunk.records.map((r) => r.type)).toEqual(['system']);
    expect(second?.chunk.lineOk).toEqual([true]);
    expect(tail.offset).toBe(Buffer.byteLength(line({ type: 'user' }) + line({ type: 'assistant' }) + line({ type: 'system' })));
  });

  it('parses a line split across two appends once', async () => {
    const path = fresh();
    const tail = createTail(path);
    expect(await tail.read()).toBeNull();
    const full = line({ type: 'user', cwd: '/home/dev/app' });
    appendFileSync(path, full.slice(0, 10));
    expect(await tail.read()).toBeNull();
    appendFileSync(path, full.slice(10));
    const got = await tail.read();
    expect(got?.chunk.lineOk).toEqual([true]);
    expect(got?.chunk.records[0]?.cwd).toBe('/home/dev/app');
    expect(await tail.read()).toBeNull();
  });

  it('keeps a multi-byte character split at a read edge intact', async () => {
    const path = fresh();
    const tail = createTail(path);
    const bytes = Buffer.from(line({ type: 'user', cwd: '/home/dev/café-\u{1f600}' }));
    const cut = bytes.indexOf(Buffer.from('\u{1f600}')) + 2; // inside the 4-byte emoji
    appendFileSync(path, bytes.subarray(0, cut));
    expect(await tail.read()).toBeNull();
    appendFileSync(path, bytes.subarray(cut));
    const got = await tail.read();
    expect(got?.chunk.records[0]?.cwd).toBe('/home/dev/café-\u{1f600}');
  });

  it('reads a file larger than one chunk without losing a line', async () => {
    const lines = Array.from({ length: 30_000 }, (_, i) => line({ type: 'user', cwd: `/home/dev/p${i}-éé` }));
    const path = fresh(lines.join(''));
    const got = await createTail(path).read();
    expect(got?.chunk.lineOk).toHaveLength(30_000);
    expect(got?.chunk.lineOk.every(Boolean)).toBe(true);
    expect(got?.chunk.records[29_999]?.cwd).toBe('/home/dev/p29999-éé');
  });

  it('resets on truncation', async () => {
    const path = fresh(line({ type: 'user' }) + line({ type: 'user' }));
    const tail = createTail(path);
    await tail.read();
    truncateSync(path, 0);
    writeFileSync(path, line({ type: 'system' }));
    const got = await tail.read();
    expect(got?.reset).toBe(true);
    expect(got?.chunk.records.map((r) => r.type)).toEqual(['system']);
  });

  it('resets when the file is replaced by a new inode', async () => {
    const path = fresh(line({ type: 'user' }));
    const tail = createTail(path);
    await tail.read();
    const other = join(base, `replacement${n++}.jsonl`);
    writeFileSync(other, line({ type: 'user' }) + line({ type: 'assistant' }) + line({ type: 'system' }));
    renameSync(other, path);
    const got = await tail.read();
    expect(got?.reset).toBe(true);
    expect(got?.chunk.records.map((r) => r.type)).toEqual(['user', 'assistant', 'system']);
  });

  it('returns null for a missing file and does not throw', async () => {
    const tail = createTail(join(base, 'missing.jsonl'));
    await expect(tail.read()).resolves.toBeNull();
    expect(tail.offset).toBe(0);
  });

  it('serialises overlapping reads', async () => {
    const path = fresh(line({ type: 'user' }));
    const tail = createTail(path);
    const [a, b] = await Promise.all([tail.read(), tail.read()]);
    expect(a?.chunk.records).toHaveLength(1);
    expect(b).toBeNull();
  });
});
