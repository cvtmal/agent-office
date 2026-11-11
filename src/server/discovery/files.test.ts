import { mkdirSync, mkdtempSync, rmSync, utimesSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { listTranscripts, readTranscripts } from './files.js';

const NOW_MS = Date.UTC(2026, 10, 11, 12);
const RECENT = (NOW_MS - 3600 * 1000) / 1000;
const OLD = (NOW_MS - 48 * 3600 * 1000) / 1000;
const S1 = '00000000-0000-4000-8000-000000000011';
const S2 = '00000000-0000-4000-8000-000000000012';
const S3 = '00000000-0000-4000-8000-000000000013';
const PROJECT = 'projects/-home-dev-code-app';

let cfg: string;

function put(rel: string, content: string, mtime = RECENT): void {
  const path = join(cfg, rel);
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, content);
  utimesSync(path, mtime, mtime);
}

beforeAll(() => {
  cfg = mkdtempSync(join(tmpdir(), 'ao-files-'));
  put(`${PROJECT}/${S1}.jsonl`, '{"type":"user"}\n');
  put(`${PROJECT}/${S1}/custom-title.json`, JSON.stringify({ customTitle: 'Alpha' }));
  put(`${PROJECT}/${S1}/subagents/nested/agent-a1.jsonl`, '{}\n');
  put(`${PROJECT}/${S1}/subagents/agent-old.jsonl`, '{}\n', OLD);
  put(`${PROJECT}/${S2}.jsonl`, '{}\n', OLD);
  put(`${PROJECT}/${S3}.jsonl`, '{}\n', OLD);
});

afterAll(() => {
  rmSync(cfg, { recursive: true, force: true });
});

describe('listTranscripts', () => {
  const opts = (): Parameters<typeof listTranscripts>[0] => ({
    cfgDir: cfg,
    cutoffMs: NOW_MS - 24 * 3600 * 1000,
    isLive: (id) => id === S3,
  });

  it('lists kept files with mtime and side-file paths, without content', () => {
    const pdir = join(cfg, PROJECT);
    expect(listTranscripts(opts())).toEqual({
      sessions: [
        { sessionId: S1, path: join(pdir, `${S1}.jsonl`), mtimeMs: RECENT * 1000, titlePath: join(pdir, S1, 'custom-title.json') },
        { sessionId: S3, path: join(pdir, `${S3}.jsonl`), mtimeMs: OLD * 1000, titlePath: join(pdir, S3, 'custom-title.json') },
      ],
      agents: [
        {
          sessionId: S1,
          agentId: 'a1',
          path: join(pdir, S1, 'subagents/nested/agent-a1.jsonl'),
          mtimeMs: RECENT * 1000,
          metaPath: join(pdir, S1, 'subagents/nested/agent-a1.meta.json'),
        },
      ],
    });
  });

  it('is what readTranscripts reads', () => {
    const listed = listTranscripts(opts());
    const read = readTranscripts(opts());
    expect(read.sessions.map((s) => s.path)).toEqual(listed.sessions.map((s) => s.path));
    expect(read.agents.map((a) => a.path)).toEqual(listed.agents.map((a) => a.path));
    expect(read.sessions[0]).toMatchObject({ text: '{"type":"user"}\n', customTitle: 'Alpha' });
  });

  it('returns empty lists for a missing config dir', () => {
    expect(listTranscripts({ ...opts(), cfgDir: join(cfg, 'missing') })).toEqual({ sessions: [], agents: [] });
  });
});
