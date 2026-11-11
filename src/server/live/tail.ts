// Reads only the bytes appended to a transcript since the last read (DATA-5, research R5).
// Read-only: the file is opened `'r'` for each read and closed again. Lines are split on the
// byte 0x0A, so a multi-byte UTF-8 character split across reads stays intact; the trailing
// partial line is kept as carry until its newline arrives.
import { open } from 'node:fs/promises';
import { parseTranscript, type ParsedTranscript } from '../reader/records.js';

const CHUNK = 1024 * 1024;
const NEWLINE = 0x0a;

export interface TailRead {
  /** The complete lines appended since the last read, parsed. */
  chunk: ParsedTranscript;
  /** True when the file was truncated or replaced: `chunk` is read from byte 0. */
  reset: boolean;
}

export interface Tail {
  /** New complete lines, or `null` when there is nothing new or the file cannot be read. Never throws. */
  read(): Promise<TailRead | null>;
  /** Bytes consumed so far (complete lines plus the carry). */
  readonly offset: number;
}

export function createTail(path: string): Tail {
  let offset = 0;
  let ino: number | null = null;
  let carry: Buffer = Buffer.alloc(0);
  let queue: Promise<unknown> = Promise.resolve();

  async function readOnce(): Promise<TailRead | null> {
    let handle;
    try {
      handle = await open(path, 'r');
    } catch {
      return null;
    }
    try {
      const stat = await handle.stat();
      let reset = false;
      if ((ino !== null && stat.ino !== ino) || stat.size < offset) {
        reset = true;
        offset = 0;
        carry = Buffer.alloc(0);
      }
      ino = stat.ino;
      const records: ParsedTranscript['records'] = [];
      const lineOk: ParsedTranscript['lineOk'] = [];
      const buffer = Buffer.alloc(Math.min(CHUNK, Math.max(0, stat.size - offset)));
      while (offset < stat.size) {
        const want = Math.min(CHUNK, stat.size - offset);
        const { bytesRead } = await handle.read(buffer, 0, want, offset);
        if (bytesRead === 0) break;
        offset += bytesRead;
        const data = carry.length > 0 ? Buffer.concat([carry, buffer.subarray(0, bytesRead)]) : buffer.subarray(0, bytesRead);
        const end = data.lastIndexOf(NEWLINE);
        if (end < 0) {
          carry = Buffer.from(data);
          continue;
        }
        carry = Buffer.from(data.subarray(end + 1));
        // A newline byte never sits inside a UTF-8 sequence, so the complete part decodes cleanly.
        const parsed = parseTranscript(data.toString('utf8', 0, end + 1));
        for (const rec of parsed.records) records.push(rec);
        for (const ok of parsed.lineOk) lineOk.push(ok);
      }
      if (!reset && lineOk.length === 0) return null;
      return { chunk: { records, lineOk }, reset };
    } catch {
      return null;
    } finally {
      await handle.close().catch(() => undefined);
    }
  }

  return {
    read(): Promise<TailRead | null> {
      // Serialised: two overlapping reads would consume the same bytes twice.
      const next = queue.then(readOnce, readOnce);
      queue = next;
      return next;
    },
    get offset(): number {
      return offset;
    },
  };
}
