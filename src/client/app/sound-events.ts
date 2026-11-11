// Which sounds a snapshot change makes (research R8), and the throttle that keeps them
// sparse. Pure: no audio, no clock (the caller passes the time).
import type { Snapshot } from '../../shared/types.js';
import { newActivities } from '../office/life/bubbles.js';
import { newOutcomes } from '../office/life/celebrate.js';

export type SoundKind = 'tick' | 'coffee' | 'fanfare';

/**
 * Sounds for the change `prev` → `next`, each kind at most once, fanfare first (it
 * overrides the others in the throttle). None for the first snapshot (`prev === null`).
 * - `tick`: a new `write` or `shell` activity.
 * - `coffee`: a character present in `prev` whose status turned `idle`.
 * - `fanfare`: a new outcome on a done wall.
 */
export function soundsFor(prev: Snapshot | null, next: Snapshot): SoundKind[] {
  if (prev === null) return [];
  const out: SoundKind[] = [];
  if (newOutcomes(prev, next).length > 0) out.push('fanfare');
  if (newActivities(prev, next).some((a) => a.kind === 'write' || a.kind === 'shell')) out.push('tick');
  const before = new Map(prev.characters.map((c) => [c.id, c.status]));
  const turnedIdle = next.characters.some((c) => {
    const old = before.get(c.id);
    return old !== undefined && old !== 'idle' && c.status === 'idle';
  });
  if (turnedIdle) out.push('coffee');
  return out;
}

export interface SoundGate {
  /** True when `kind` may play at `nowMs`; a sound that is let through starts a new gap. */
  allow(kind: SoundKind, nowMs: number): boolean;
}

/** At most one sound per `minGapMs`; `fanfare` always passes and restarts the gap. */
export function createGate(minGapMs = 200): SoundGate {
  let last: number | null = null;
  return {
    allow(kind, nowMs) {
      if (kind !== 'fanfare' && last !== null && nowMs - last < minGapMs) return false;
      last = nowMs;
      return true;
    },
  };
}
