import { appendFileSync, mkdtempSync, renameSync, rmSync, truncateSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { setFlagsFromString } from 'node:v8';
import { runInNewContext } from 'node:vm';
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

  it('hands a large file to `each` piece by piece, flagging only the first piece of a reset (#7 memory)', async () => {
    const lines = Array.from({ length: 30_000 }, (_, i) => line({ type: 'user', cwd: `/home/dev/p${i}-éé` }));
    const path = fresh(lines.join(''));
    const tail = createTail(path);
    const pieces: { count: number; reset: boolean }[] = [];
    let last = '';
    const got = await tail.read((chunk, reset) => {
      pieces.push({ count: chunk.lineOk.length, reset });
      last = chunk.records.at(-1)?.cwd ?? last;
    });
    expect(pieces.length).toBeGreaterThan(1);
    expect(pieces.reduce((sum, p) => sum + p.count, 0)).toBe(30_000);
    expect(pieces.every((p) => !p.reset)).toBe(true);
    expect(last).toBe('/home/dev/p29999-éé');
    expect(got?.chunk.records).toEqual([]);
    expect(await tail.read(() => expect.fail('nothing new'))).toBeNull();
    truncateSync(path, 0);
    const resets: boolean[] = [];
    expect((await tail.read((_, reset) => resets.push(reset)))?.reset).toBe(true);
    expect(resets).toEqual([true]);
    writeFileSync(path, lines.join(''));
    const again: boolean[] = [];
    await tail.read((_, reset) => again.push(reset));
    expect(again[0]).toBe(false);
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

  it('keeps no reference to a read result once the caller drops it (#7 memory)', async () => {
    setFlagsFromString('--expose-gc');
    const gc = runInNewContext('gc') as () => void;
    const path = fresh(Array.from({ length: 2000 }, (_, i) => line({ type: 'user', uuid: String(i) })).join(''));
    const tail = createTail(path);
    // The result lives only inside this function, so after it returns only the tail could hold it.
    const ref = await (async () => {
      const read = await tail.read();
      expect(read?.chunk.records).toHaveLength(2000);
      return new WeakRef(read?.chunk.records ?? []);
    })();
    for (let i = 0; i < 5 && ref.deref() !== undefined; i++) {
      await new Promise((resolve) => setTimeout(resolve, 10));
      gc();
    }
    expect(ref.deref()).toBeUndefined();
    expect(tail.offset).toBeGreaterThan(0);
  });
});
