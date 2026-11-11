// A character's look (plan P-5): one variant index per look field, hashed from the
// character id, so the same id always looks the same (OFFICE-3). No room-level
// de-duplication: a look never depends on who else is present. DOM-free.
import { fnv1a } from '../render/hash.js';
import { AGENT_SPACE, INTERN_SPACE, LOOK_FIELDS, type LookField } from '../sprites/characters/space.js';

/** Variant index per look field (each `< space[field]`), plus which frame size it is for. */
export type Look = Readonly<Record<LookField, number>> & {
  /** Interns (subagents, 24x36) have their own, smaller look space. */
  readonly intern: boolean;
};

/** The look of a character id: per field `fnv1a(id + ':' + field) % count`. */
export function lookFor(id: string, intern: boolean): Look {
  const space = intern ? INTERN_SPACE : AGENT_SPACE;
  const fields = Object.fromEntries(LOOK_FIELDS.map((f) => [f, fnv1a(`${id}:${f}`) % space[f]])) as Record<
    LookField,
    number
  >;
  return { ...fields, intern };
}

/** Stable cache key of a look, e.g. `a:3.1.1.0.2.4.0.1` (`i:` for interns). */
export function lookKey(look: Look): string {
  return `${look.intern ? 'i' : 'a'}:${LOOK_FIELDS.map((f) => String(look[f])).join('.')}`;
}
