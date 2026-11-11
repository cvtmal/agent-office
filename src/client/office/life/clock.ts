// Estimated server time on the client (research R2): the snapshot has no `statusSince`
// and deltas leave `generatedAt` unchanged, so "now" is the newest timestamp seen plus
// the client time ticked since it last rose. Never moves back. DOM-free.
import type { Snapshot } from '../../../shared/types.js';

/** A clock of estimated server time in epoch ms. */
export interface ServerClock {
  /** Takes the newest of `generatedAt`, every `lastActivityAt` and every activity `at`. */
  observe(snapshot: Snapshot): void;
  /** Advances by client ms; called only from the un-paused update, so pause freezes it. */
  tick(dtMs: number): void;
  /** Estimated server now, or null before the first observe. */
  now(): number | null;
}

/** Newest timestamp (ms) in a snapshot, or null if it has none that parses. */
export function newestMs(snapshot: Snapshot): number | null {
  let newest = Number.NEGATIVE_INFINITY;
  const see = (iso: string | null): void => {
    if (iso === null) return;
    const ms = Date.parse(iso);
    if (!Number.isNaN(ms) && ms > newest) newest = ms;
  };
  see(snapshot.generatedAt);
  for (const c of snapshot.characters) see(c.lastActivityAt);
  for (const a of snapshot.activities) see(a.at);
  return Number.isFinite(newest) ? newest : null;
}

export function createServerClock(): ServerClock {
  let seen: number | null = null;
  let base = 0;
  let elapsed = 0;
  const now = (): number | null => (seen === null ? null : base + elapsed);
  return {
    observe(snapshot) {
      const newest = newestMs(snapshot);
      if (newest === null || (seen !== null && newest <= seen)) return;
      base = Math.max(newest, now() ?? newest);
      seen = newest;
      elapsed = 0;
    },
    tick(dtMs) {
      if (seen !== null) elapsed += dtMs;
    },
    now,
  };
}
