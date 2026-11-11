import { chmodSync, mkdirSync, mkdtempSync, rmSync, utimesSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { discover, type Discovered, type ProcessRow } from './index.js';

const NOW = new Date('2026-11-11T12:00:00.000Z');
const RECENT = (NOW.getTime() - 3600 * 1000) / 1000;
const OLD = (NOW.getTime() - 48 * 3600 * 1000) / 1000;

const S1 = '00000000-0000-4000-8000-000000000001';
const S2 = '00000000-0000-4000-8000-000000000002';
const S3 = '00000000-0000-4000-8000-000000000003';
const S4 = '00000000-0000-4000-8000-000000000004';

let cfg: string;
let result: Discovered;

function put(rel: string, content: string, mtime = RECENT): string {
  const path = join(cfg, rel);
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, content);
  utimesSync(path, mtime, mtime);
  return path;
}

beforeAll(() => {
  cfg = mkdtempSync(join(tmpdir(), 'ao-discover-'));
  const p = 'projects/-home-dev-code-app';
  put(`${p}/${S1}.jsonl`, '{"type":"user"}\n');
  put(`${p}/${S1}/custom-title.json`, JSON.stringify({ customTitle: 'Alpha' }));
  put(`${p}/${S1}/subagents/agent-a1.jsonl`, '{"type":"assistant"}\n');
  put(
    `${p}/${S1}/subagents/agent-a1.meta.json`,
    JSON.stringify({ agentType: 'Explore', description: 'look around', name: 7, finished: true, stoppedByUser: 'yes' }),
  );
  put(`${p}/${S1}/subagents/nested/deeper/agent-a2.jsonl`, '{}\n');
  put(`${p}/${S1}/subagents/nested/deeper/agent-a2.meta.json`, '{garbage');
  put(`${p}/${S1}/subagents/agent-a5.jsonl`, '{}\n');
  chmodSync(put(`${p}/${S1}/subagents/agent-a5.meta.json`, '{"name":"x"}'), 0o000);
  put(`${p}/${S1}/subagents/agent-old.jsonl`, '{}\n', OLD);
  put(`${p}/${S2}.jsonl`, '{}\n', OLD);
  put(`${p}/${S3}.jsonl`, '{}\n', OLD);
  put(`projects/-home-dev-other/${S4}/subagents/agent-a4.jsonl`, '{}\n');
  put(`projects/-home-dev-other/notes.txt`, 'x');
  put('sessions/500.json', JSON.stringify({ pid: 500, sessionId: S3, updatedAt: 1 }));
  put('sessions/501.json', JSON.stringify({ pid: 501, sessionId: S2, updatedAt: 1 }));
  const table = new Map<number, ProcessRow>([
    [500, { pid: 500, startedAt: null, command: 'claude --agent-name dev --team-name core' }],
  ]);
  result = discover({ cfgDir: cfg, now: NOW, maxAgeHours: 24, table });
});

afterAll(() => {
  rmSync(cfg, { recursive: true, force: true });
});

describe('discover', () => {
  it('finds sessions with their custom title and mtime', () => {
    const s1 = result.sessions.find((s) => s.sessionId === S1);
    expect(s1).toMatchObject({ customTitle: 'Alpha', text: '{"type":"user"}\n', mtimeMs: RECENT * 1000 });
    expect(s1?.path).toBe(join(cfg, 'projects/-home-dev-code-app', `${S1}.jsonl`));
  });

  it('drops an old session and keeps an old one that is registered live', () => {
    expect(result.sessions.map((s) => s.sessionId).sort()).toEqual([S1, S3]);
  });

  it('finds agents, nested and orphaned, and drops old agent files', () => {
    expect(result.agents.map((a) => `${a.sessionId}/${a.agentId}`).sort()).toEqual(
      [`${S1}/a1`, `${S1}/a2`, `${S1}/a5`, `${S4}/a4`].sort(),
    );
  });

  it('reads agent meta; garbage, unreadable or missing meta is null', () => {
    const meta = (id: string) => result.agents.find((a) => a.agentId === id)?.meta;
    expect(meta('a1')).toEqual({
      agentType: 'Explore',
      description: 'look around',
      name: null,
      finished: true,
      stoppedByUser: false,
    });
    expect(meta('a2')).toBeNull();
    if (process.getuid?.() !== 0) expect(meta('a5')).toBeNull();
    expect(meta('a4')).toBeNull();
  });

  it('returns the live registry and teammates from the table', () => {
    expect([...result.registry.keys()]).toEqual([S3]);
    expect(result.teammates).toEqual([{ agentName: 'dev', teamName: 'core' }]);
  });

  it('has no teammates without a table and copes with a missing config dir', () => {
    const empty = discover({ cfgDir: join(cfg, 'missing'), now: NOW, maxAgeHours: 24, table: null });
    expect(empty).toEqual({ sessions: [], agents: [], registry: new Map(), teammates: [] });
  });
});
