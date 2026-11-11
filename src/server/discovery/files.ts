// Session and agent transcripts under `<config>/projects/*/` (scope DATA-1; ctx:363,
// 414-423, 529-532). Read-only; any per-file IO error skips that file.
import { readdirSync, readFileSync, statSync, type Dirent } from 'node:fs';
import { join } from 'node:path';
import type { AgentMeta, RawAgent, RawSession } from './types.js';

const AGENT_FILE = /^agent-(.+)\.jsonl$/;

function entries(dir: string): Dirent[] {
  try {
    return readdirSync(dir, { withFileTypes: true }).sort((a, b) => (a.name < b.name ? -1 : a.name > b.name ? 1 : 0));
  } catch {
    return [];
  }
}

/** mtime and text of a file, or null when either cannot be read. */
function readFile(path: string): { mtimeMs: number; text: string } | null {
  try {
    const { mtimeMs } = statSync(path);
    return { mtimeMs, text: readFileSync(path, 'utf8') };
  } catch {
    return null;
  }
}

function mtimeOf(path: string): number | null {
  try {
    return statSync(path).mtimeMs;
  } catch {
    return null;
  }
}

function readObject(path: string): Record<string, unknown> | null {
  try {
    const value: unknown = JSON.parse(readFileSync(path, 'utf8'));
    return typeof value === 'object' && value !== null && !Array.isArray(value)
      ? (value as Record<string, unknown>)
      : null;
  } catch {
    return null;
  }
}

function str(value: unknown): string | null {
  return typeof value === 'string' ? value : null;
}

function readCustomTitle(path: string): string | null {
  return str(readObject(path)?.['customTitle']);
}

function readMeta(path: string): AgentMeta | null {
  const raw = readObject(path);
  if (!raw) return null;
  return {
    agentType: str(raw['agentType']),
    description: str(raw['description']),
    name: str(raw['name']),
    finished: raw['finished'] === true,
    stoppedByUser: raw['stoppedByUser'] === true,
  };
}

/** `agent-<id>.jsonl` files anywhere under `dir`, recursively (no symlinks followed). */
function agentFiles(dir: string, out: { path: string; agentId: string }[] = []): { path: string; agentId: string }[] {
  for (const entry of entries(dir)) {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) {
      agentFiles(path, out);
      continue;
    }
    const match = entry.isFile() ? AGENT_FILE.exec(entry.name) : null;
    if (match?.[1]) out.push({ path, agentId: match[1] });
  }
  return out;
}

export interface TranscriptOptions {
  cfgDir: string;
  /** Files older than this (epoch ms) are dropped... */
  cutoffMs: number;
  /** ...unless the session id is registered live (sessions only; decision P5). */
  isLive: (sessionId: string) => boolean;
}

/** Reads every kept session and agent transcript of every project dir. */
export function readTranscripts(opts: TranscriptOptions): { sessions: RawSession[]; agents: RawAgent[] } {
  const sessions: RawSession[] = [];
  const agents: RawAgent[] = [];
  const projects = join(opts.cfgDir, 'projects');
  for (const project of entries(projects)) {
    if (!project.isDirectory()) continue;
    const pdir = join(projects, project.name);
    for (const entry of entries(pdir)) {
      const path = join(pdir, entry.name);
      if (entry.isFile() && entry.name.endsWith('.jsonl')) {
        const sessionId = entry.name.slice(0, -'.jsonl'.length);
        const mtimeMs = mtimeOf(path);
        if (mtimeMs === null || (mtimeMs < opts.cutoffMs && !opts.isLive(sessionId))) continue;
        const file = readFile(path);
        if (!file) continue;
        const customTitle = readCustomTitle(join(pdir, sessionId, 'custom-title.json'));
        sessions.push({ sessionId, path, mtimeMs: file.mtimeMs, text: file.text, customTitle });
      } else if (entry.isDirectory()) {
        // read even when `<sessionId>.jsonl` is gone (ctx:416-423)
        for (const { path: apath, agentId } of agentFiles(join(path, 'subagents'))) {
          const mtimeMs = mtimeOf(apath);
          if (mtimeMs === null || mtimeMs < opts.cutoffMs) continue;
          const file = readFile(apath);
          if (!file) continue;
          const meta = readMeta(apath.replace(/\.jsonl$/, '.meta.json'));
          agents.push({ sessionId: entry.name, agentId, path: apath, mtimeMs: file.mtimeMs, text: file.text, meta });
        }
      }
    }
  }
  return { sessions, agents };
}
