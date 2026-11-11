/**
 * Character status (research D1, D2; planning decision P2). `waiting` comes from the registry only.
 * Pure: no file or process access.
 */
import type { Status } from '../../shared/constants.js';
import type { AgentMeta, RegistryEntry } from '../discovery/types.js';
import { mainRecords, type FileKind, type Rec } from './records.js';

/** Why a session counts as live: its registry entry, or a matching teammate process (D3). */
export type LiveBy = 'registry' | 'teammate';

/** `system` subtypes that close a turn. */
const TURN_END_SUBTYPES = new Set(['stop_hook_summary', 'turn_duration']);

function isRelevant(rec: Rec): boolean {
  return (
    rec.type === 'user' ||
    rec.type === 'assistant' ||
    (rec.type === 'system' && rec.subtype !== null && TURN_END_SUBTYPES.has(rec.subtype))
  );
}

/** The transcript rule: busy while a turn is open, idle once it has ended (or nothing happened yet). */
export function transcriptStatus(records: Rec[], kind: FileKind): 'busy' | 'idle' {
  const main = mainRecords(records, kind);
  let last: Rec | undefined;
  for (let i = main.length - 1; i >= 0; i--) {
    const rec = main[i];
    if (rec !== undefined && isRelevant(rec)) {
      last = rec;
      break;
    }
  }
  if (last === undefined || last.type === 'system') {
    return 'idle';
  }
  if (last.type === 'user') {
    return 'busy';
  }
  if (last.stopReason === 'end_turn') {
    return 'idle';
  }
  if (last.stopReason === 'tool_use' || last.content.some((block) => block.type === 'tool_use')) {
    return 'busy';
  }
  // P2: an assistant record without end_turn and without tool_use is mid-turn.
  return 'busy';
}

/** A registry `status` as a Status; null when absent or unknown. */
export function registryStatus(v: string | null): Status | null {
  switch (v) {
    case 'busy':
    case 'shell':
      return 'busy';
    case 'waiting':
      return 'waiting';
    case 'idle':
      return 'idle';
    default:
      return null;
  }
}

/** D1 rows 1–3: registry status, else the transcript rule; a teammate uses the transcript rule; not live → ended. */
export function sessionStatus(liveBy: LiveBy | null, entry: RegistryEntry | null, records: Rec[]): Status {
  if (liveBy === null) {
    return 'ended';
  }
  if (liveBy === 'registry') {
    return registryStatus(entry?.status ?? null) ?? transcriptStatus(records, 'session');
  }
  return transcriptStatus(records, 'session');
}

/** D1 rows 4–7: parent not live → ended; stopped by user → stopped; finished → idle; else busy. */
export function agentStatus(parentLive: boolean, meta: AgentMeta | null): Status {
  if (!parentLive) {
    return 'ended';
  }
  if (meta?.stoppedByUser === true) {
    return 'stopped';
  }
  if (meta?.finished === true) {
    return 'idle';
  }
  return 'busy';
}
