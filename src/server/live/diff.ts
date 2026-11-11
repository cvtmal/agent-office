// Snapshot → SSE deltas (live-api research R2, R3). Pure: compares two snapshots by id.
import type { Activity, ServerEvent, Snapshot } from '../../shared/types.js';

const activityKey = (a: Activity): string => `${a.characterId}|${a.at}|${a.tool}|${a.target}`;

/**
 * The events that take a client holding `prev` to `next`. No `prev` → one `snapshot`. A character or
 * project that left the model → one `snapshot` (R3: no removal event in the contract). Otherwise:
 * `project` for each new or changed project, `character` for each new or changed character, `activity`
 * for each activity of `next` not in `prev`, in that order. `generatedAt` is ignored.
 */
export function diffSnapshots(prev: Snapshot | null, next: Snapshot): ServerEvent[] {
  if (prev === null) return [{ type: 'snapshot', data: next }];
  const nextProjects = new Set(next.projects.map((p) => p.id));
  const nextCharacters = new Set(next.characters.map((c) => c.id));
  if (prev.projects.some((p) => !nextProjects.has(p.id)) || prev.characters.some((c) => !nextCharacters.has(c.id))) {
    return [{ type: 'snapshot', data: next }];
  }

  const events: ServerEvent[] = [];
  const prevProjects = new Map(prev.projects.map((p) => [p.id, JSON.stringify(p)]));
  for (const project of next.projects) {
    if (prevProjects.get(project.id) !== JSON.stringify(project)) events.push({ type: 'project', data: project });
  }
  const prevCharacters = new Map(prev.characters.map((c) => [c.id, JSON.stringify(c)]));
  for (const character of next.characters) {
    if (prevCharacters.get(character.id) !== JSON.stringify(character)) {
      events.push({ type: 'character', data: character });
    }
  }
  const seen = new Set(prev.activities.map(activityKey));
  for (const activity of next.activities) {
    if (!seen.has(activityKey(activity))) events.push({ type: 'activity', data: activity });
  }
  return events;
}
