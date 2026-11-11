// Folds one server event into a snapshot (research R4, R13). Pure: the input is never mutated, and
// the same object comes back when the event changes nothing, so callers can skip a store update.
import { ACTIVITIES_PER_CHARACTER } from '../../shared/constants.js';
import type { Activity, ServerEvent, Snapshot } from '../../shared/types.js';

/** The snapshot after `e`; `null` while no `snapshot` event has arrived yet. */
export function applyEvent(snapshot: Snapshot | null, e: ServerEvent): Snapshot | null {
  if (e.type === 'snapshot') return e.data;
  if (snapshot === null) return null;
  switch (e.type) {
    case 'character': {
      const characters = upsertById(snapshot.characters, e.data);
      return characters === snapshot.characters ? snapshot : { ...snapshot, characters };
    }
    case 'project': {
      const projects = upsertById(snapshot.projects, e.data);
      return projects === snapshot.projects ? snapshot : { ...snapshot, projects };
    }
    case 'activity': {
      const activities = appendActivity(snapshot, e.data);
      return activities === snapshot.activities ? snapshot : { ...snapshot, activities };
    }
  }
}

// Same order as the server's snapshot: by id (src/server/reader/model.ts `byId`).
function upsertById<T extends { id: string }>(list: T[], item: T): T[] {
  const i = list.findIndex((x) => x.id === item.id);
  if (i >= 0) {
    if (sameJson(list[i], item)) return list;
    return list.map((x, j) => (j === i ? item : x));
  }
  const at = list.findIndex((x) => x.id > item.id);
  const next = [...list];
  next.splice(at < 0 ? list.length : at, 0, item);
  return next;
}

// Same order as the server's snapshot: by `at`, then character id; at most
// ACTIVITIES_PER_CHARACTER per character, the newest kept.
function appendActivity(snapshot: Snapshot, activity: Activity): Activity[] {
  const list = snapshot.activities;
  if (!snapshot.characters.some((c) => c.id === activity.characterId)) return list;
  const pos = list.findIndex((a) => before(activity, a));
  const next = [...list];
  next.splice(pos < 0 ? list.length : pos, 0, activity);

  const own = next.filter((a) => a.characterId === activity.characterId);
  const drop = new Set(own.slice(0, Math.max(0, own.length - ACTIVITIES_PER_CHARACTER)));
  if (drop.has(activity)) return list;
  return drop.size === 0 ? next : next.filter((a) => !drop.has(a));
}

function before(a: Activity, b: Activity): boolean {
  return a.at < b.at || (a.at === b.at && a.characterId < b.characterId);
}

// Structural equality of JSON values (the API contract holds nothing else).
function sameJson(a: unknown, b: unknown): boolean {
  if (a === b) return true;
  if (typeof a !== 'object' || typeof b !== 'object' || a === null || b === null) return false;
  if (Array.isArray(a) !== Array.isArray(b)) return false;
  const ka = Object.keys(a);
  const kb = Object.keys(b);
  if (ka.length !== kb.length) return false;
  const ra = a as Record<string, unknown>;
  const rb = b as Record<string, unknown>;
  return ka.every((k) => Object.hasOwn(rb, k) && sameJson(ra[k], rb[k]));
}
