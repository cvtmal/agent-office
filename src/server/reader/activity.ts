/**
 * Activities (scope DATA-3, research D8): one per `tool_use` block of the file's own assistant records.
 * `api-request-blob` records copy request content and are never read here. Pure: no file or process access.
 */
import { ACTIVITIES_PER_CHARACTER } from '../../shared/constants.js';
import { toolKind } from '../../shared/tools.js';
import type { Activity } from '../../shared/types.js';
import { mainRecords, type FileKind, type Rec } from './records.js';
import { detailText, shapeTarget } from './target.js';

export interface ActivityOptions {
  /** Detail mode: each activity also carries `detail` (`detailText`); off: no `detail` key at all. */
  detail?: boolean;
}

/** The tool calls of one transcript, in file order; records without a timestamp are skipped. */
export function activitiesOf(records: Rec[], kind: FileKind, characterId: string, opts: ActivityOptions = {}): Activity[] {
  const activities: Activity[] = [];
  for (const rec of mainRecords(records, kind)) {
    if (rec.type !== 'assistant' || rec.timestamp === null) {
      continue;
    }
    for (const block of rec.content) {
      if (block.type === 'tool_use') {
        const activity: Activity = {
          characterId,
          at: rec.timestamp,
          tool: block.name,
          kind: toolKind(block.name),
          target: shapeTarget(block.name, block.input),
        };
        if (opts.detail === true) activity.detail = detailText(block.name, block.input);
        activities.push(activity);
      }
    }
  }
  return activities;
}

/** The last `n` activities of a list. */
export function lastActivities(list: Activity[], n: number = ACTIVITIES_PER_CHARACTER): Activity[] {
  return n <= 0 ? [] : list.slice(-n);
}
