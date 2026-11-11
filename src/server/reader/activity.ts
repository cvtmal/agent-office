/**
 * Activities (scope DATA-3, research D8): one per `tool_use` block of the file's own assistant records.
 * `api-request-blob` records copy request content and are never read here. Pure: no file or process access.
 */
import { ACTIVITIES_PER_CHARACTER } from '../../shared/constants.js';
import { toolKind } from '../../shared/tools.js';
import type { Activity } from '../../shared/types.js';
import { mainRecords, type FileKind, type Rec } from './records.js';
import { shapeTarget } from './target.js';

/** The tool calls of one transcript, in file order; records without a timestamp are skipped. */
export function activitiesOf(records: Rec[], kind: FileKind, characterId: string): Activity[] {
  const activities: Activity[] = [];
  for (const rec of mainRecords(records, kind)) {
    if (rec.type !== 'assistant' || rec.timestamp === null) {
      continue;
    }
    for (const block of rec.content) {
      if (block.type === 'tool_use') {
        activities.push({
          characterId,
          at: rec.timestamp,
          tool: block.name,
          kind: toolKind(block.name),
          target: shapeTarget(block.name, block.input),
        });
      }
    }
  }
  return activities;
}

/** The last `n` activities of a list. */
export function lastActivities(list: Activity[], n: number = ACTIVITIES_PER_CHARACTER): Activity[] {
  return n <= 0 ? [] : list.slice(-n);
}
