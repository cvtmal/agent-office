// Speech bubbles (research R6, OFFICE-6): one per character, icon + short target; the
// content changes at most once per BUBBLE_MIN_CHANGE_MS (newest pending call wins, a
// `xN` counter shows coalesced calls); hidden BUBBLE_SHOW_MS after its last change.
// Only activities first seen after the first snapshot make bubbles. DOM-free.
import type { ActivityKind } from '../../../shared/constants.js';
import type { Activity, Snapshot } from '../../../shared/types.js';
import { BUBBLE_GLYPHS, BUBBLE_MIN_CHANGE_MS, BUBBLE_SHOW_MS } from './constants.js';

/** A visible bubble. */
export interface Bubble {
  characterId: string;
  kind: ActivityKind;
  text: string;
  /** Calls this content stands for (1 = a single call). */
  count: number;
}

/** The bubble state of a set of characters. */
export interface Bubbles {
  /** An activity seen at client time `ms`. */
  push(a: Activity, ms: number): void;
  /** Shows held content whose turn has come; forgets bubbles that have hidden. */
  step(ms: number): void;
  /** Bubbles visible at `ms`, ordered by character id. */
  visible(ms: number): Bubble[];
}

const keyOf = (a: Activity): string => `${a.characterId}|${a.at}|${a.tool}|${a.target}`;

/** Activities of `next` not in `prev`; none when `prev` is null (no bubbles for history). */
export function newActivities(prev: Snapshot | null, next: Snapshot): Activity[] {
  if (prev === null) return [];
  const seen = new Set(prev.activities.map(keyOf));
  return next.activities.filter((a) => !seen.has(keyOf(a)));
}

/** Bubble text: `target` cut to fit BUBBLE_GLYPHS with `…`, plus ` xN` when `count > 1` (the pixel font has no `×` glyph). */
export function bubbleText(target: string, count: number): string {
  const suffix = count > 1 ? ` x${String(count)}` : '';
  const glyphs = [...target];
  const room = BUBBLE_GLYPHS - [...suffix].length;
  const body = glyphs.length <= room ? target : `${glyphs.slice(0, Math.max(0, room - 1)).join('')}…`;
  return body + suffix;
}

interface State {
  shown: Activity;
  count: number;
  changedAt: number;
  pending: { activity: Activity; count: number } | null;
}

const toBubble = (id: string, s: State): Bubble => ({
  characterId: id,
  kind: s.shown.kind,
  text: bubbleText(s.shown.target === '' ? s.shown.tool : s.shown.target, s.count),
  count: s.count,
});

export function createBubbles(): Bubbles {
  const states = new Map<string, State>();
  const flush = (s: State, ms: number): void => {
    if (s.pending === null || ms - s.changedAt < BUBBLE_MIN_CHANGE_MS) return;
    s.shown = s.pending.activity;
    s.count = s.pending.count;
    s.changedAt = ms;
    s.pending = null;
  };
  return {
    push(a, ms) {
      const s = states.get(a.characterId);
      if (s === undefined || (s.pending === null && ms - s.changedAt >= BUBBLE_SHOW_MS)) {
        states.set(a.characterId, { shown: a, count: 1, changedAt: ms, pending: null });
        return;
      }
      s.pending = { activity: a, count: (s.pending?.count ?? 0) + 1 };
      flush(s, ms);
    },
    step(ms) {
      for (const [id, s] of states) {
        flush(s, ms);
        if (s.pending === null && ms - s.changedAt >= BUBBLE_SHOW_MS) states.delete(id);
      }
    },
    visible(ms) {
      return [...states.entries()]
        .filter(([, s]) => ms - s.changedAt < BUBBLE_SHOW_MS)
        .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
        .map(([id, s]) => toBubble(id, s));
    },
  };
}
