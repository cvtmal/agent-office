// The config file's `projects` and `exclude` applied to a snapshot (RUN-2, research R10). Pure.
import type { Snapshot } from '../../shared/types.js';
import type { Config } from '../config/file.js';
import { globMatch } from '../config/glob.js';

/**
 * The snapshot filter for `config` (`~` already expanded by `loadConfig`):
 * - `projects` non-empty: keep only projects whose id is in it;
 * - drop projects whose id matches an `exclude` glob, and characters whose `cwd` matches one,
 *   with their descendants and activities; a project left without characters by that goes too.
 * The identity when both lists are empty.
 */
export function filterFor(config: Pick<Config, 'projects' | 'exclude'>): (s: Snapshot) => Snapshot {
  const { projects, exclude } = config;
  if (projects.length === 0 && exclude.length === 0) return (s) => s;
  const wanted = new Set(projects);
  const excluded = (path: string): boolean => exclude.some((pattern) => globMatch(pattern, path));

  return (s) => {
    const projectIds = new Set(
      s.projects.filter((p) => (wanted.size === 0 || wanted.has(p.id)) && !excluded(p.id)).map((p) => p.id),
    );

    // Characters arrive in any order: drop until no parent is left behind.
    const dropped = new Set<string>();
    for (const c of s.characters) {
      if (!projectIds.has(c.projectId) || (c.cwd !== null && excluded(c.cwd))) dropped.add(c.id);
    }
    for (let changed = true; changed; ) {
      changed = false;
      for (const c of s.characters) {
        if (!dropped.has(c.id) && c.parentId !== null && dropped.has(c.parentId)) {
          dropped.add(c.id);
          changed = true;
        }
      }
    }
    if (dropped.size === 0 && projectIds.size === s.projects.length) return s;

    const characters = s.characters.filter((c) => !dropped.has(c.id));
    const occupied = new Set(characters.map((c) => c.projectId));
    const hadCharacters = new Set(s.characters.map((c) => c.projectId));
    return {
      ...s,
      projects: s.projects.filter((p) => projectIds.has(p.id) && (occupied.has(p.id) || !hadCharacters.has(p.id))),
      characters,
      activities: s.activities.filter((a) => !dropped.has(a.characterId)),
    };
  };
}
