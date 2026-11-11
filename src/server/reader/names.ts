/**
 * Display names of sessions and agents (research § Evidence names, `ctx:342-351,371`; planning decisions P3, P6).
 * Every name is one line of at most 40 characters (`clean`). Pure: no file or process access.
 */
import type { AgentMeta } from '../discovery/types.js';
import { mainRecords, type Rec } from './records.js';
import { clean } from './target.js';

/** The first candidate that is non-empty after `clean`; else `''`. */
function firstName(candidates: (string | null | undefined)[]): string {
  for (const candidate of candidates) {
    if (typeof candidate === 'string') {
      const name = clean(candidate);
      if (name !== '') {
        return name;
      }
    }
  }
  return '';
}

/** The value of the newest record (last in file order) for which `pick` gives a string. */
function newest(records: Rec[], pick: (rec: Rec) => string | null): string | null {
  for (let i = records.length - 1; i >= 0; i--) {
    const rec = records[i];
    const value = rec === undefined ? null : pick(rec);
    if (value !== null && clean(value) !== '') {
      return value;
    }
  }
  return null;
}

/**
 * Registry name → `custom-title.json` → newest `custom-title` record → newest `agent-name` record →
 * newest record `agentName` → newest `ai-title` record → first 8 chars of the id. P3: the whole file is searched.
 */
export function sessionName(
  sessionId: string,
  registryName: string | null,
  customTitleFile: string | null,
  records: Rec[],
): string {
  const main = mainRecords(records, 'session');
  return firstName([
    registryName,
    customTitleFile,
    newest(main, (rec) => (rec.type === 'custom-title' ? rec.customTitle : null)),
    newest(main, (rec) => (rec.type === 'agent-name' ? rec.agentName : null)),
    newest(main, (rec) => rec.agentName),
    newest(main, (rec) => (rec.type === 'ai-title' ? rec.aiTitle : null)),
    sessionId.slice(0, 8),
  ]);
}

/** Meta `name` → newest record `agentName` → meta `description` (P6) → meta `agentType` → agent id. */
export function agentDisplayName(agentId: string, meta: AgentMeta | null, records: Rec[]): string {
  return firstName([
    meta?.name,
    newest(records, (rec) => rec.agentName),
    meta?.description,
    meta?.agentType,
    agentId,
  ]);
}
