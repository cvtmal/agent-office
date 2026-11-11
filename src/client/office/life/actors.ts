// Actors (research R3-R5, R10): where each character wants to be (targets by status),
// where it is now (walking along grid paths, never teleporting) and what it shows
// (pose frame). `buildScene`/`assignSeats` decide the seat; life decides the rest. DOM-free.
import type { ActivityKind } from '../../../shared/constants.js';
import type { Activity, Character } from '../../../shared/types.js';
import { characterFrame, isSeated, spot as spotOf, type Rect, type Spot, type SpotKind } from '../layout.js';
import {
  CHEER_FRAME_MS,
  CHEER_FRAME_NAMES,
  COUCH_AFTER_MS,
  HEAD_FRAME,
  WALK_FRAME_MS,
  WALK_FRAME_NAMES,
  WALK_FRAMES,
  WALK_PX_PER_S,
} from './constants.js';
import type { Grid, Point } from './grid.js';
import { findPath } from './path.js';

/** What a character is doing where it stands. */
export type Pose = 'sit' | 'stand' | 'walk' | 'headDown' | 'raiseHand' | 'coffee' | 'couch' | 'cheer';

/** Where a character wants to be; `(x, y)` is the feet point of `spot`. */
export interface Target {
  x: number;
  y: number;
  spot: string;
  seated: boolean;
  pose: Pose;
  /** Busy: the newest activity's kind (`write` when none); else null. */
  kind: ActivityKind | null;
}

/** What `planTargets` needs of a character. */
export type TargetCharacter = Pick<Character, 'id' | 'status' | 'lastActivityAt'>;

const KITCHEN = ['kitchen-1', 'kitchen-2', 'kitchen-3', 'kitchen-4'] as const;
const COUCH = ['couch-1', 'couch-2'] as const;

const target = (s: Spot, pose: Pose, kind: ActivityKind | null = null): Target => ({
  x: s.x,
  y: s.y,
  spot: s.name,
  seated: isSeated(s.kind),
  pose,
  kind,
});

const byId = (a: { id: string }, b: { id: string }): number => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0);

/**
 * Targets by status (R3): busy/waiting/stopped -> own seat (`sit`/`raiseHand`/`headDown`);
 * idle -> `kitchen-1..4` by id (overflow `kitchen-4`), or `couch-1/2` by id once idle for
 * `COUCH_AFTER_MS` (couch overflow stays in the kitchen); ended -> `door`. A character
 * without a seat (overflow) gets no target.
 */
export function planTargets(
  characters: readonly TargetCharacter[],
  seatOf: (id: string) => Spot | undefined,
  activities: readonly Activity[],
  nowMs: number | null,
): Map<string, Target> {
  const newest = new Map<string, Activity>();
  for (const a of activities) {
    const prev = newest.get(a.characterId);
    if (prev === undefined || Date.parse(a.at) > Date.parse(prev.at)) newest.set(a.characterId, a);
  }

  const targets = new Map<string, Target>();
  const idle: TargetCharacter[] = [];
  for (const c of characters) {
    const seat = seatOf(c.id);
    if (seat === undefined) continue;
    if (c.status === 'busy') targets.set(c.id, target(seat, 'sit', newest.get(c.id)?.kind ?? 'write'));
    else if (c.status === 'waiting') targets.set(c.id, target(seat, 'raiseHand'));
    else if (c.status === 'stopped') targets.set(c.id, target(seat, 'headDown'));
    else if (c.status === 'ended') targets.set(c.id, target(spotOf('door'), 'stand'));
    else idle.push(c);
  }

  const longIdle = (c: TargetCharacter): boolean =>
    nowMs !== null && (c.lastActivityAt === null || nowMs - Date.parse(c.lastActivityAt) >= COUCH_AFTER_MS);
  const sorted = [...idle].sort(byId);
  let couch = 0;
  const kitchen: TargetCharacter[] = [];
  for (const c of sorted) {
    const name = longIdle(c) ? COUCH[couch] : undefined;
    if (name === undefined) {
      kitchen.push(c);
      continue;
    }
    couch++;
    targets.set(c.id, target(spotOf(name), 'couch'));
  }
  kitchen.forEach((c, i) => {
    targets.set(c.id, target(spotOf(KITCHEN[Math.min(i, KITCHEN.length - 1)] ?? 'kitchen-4'), 'coffee'));
  });
  return targets;
}

/** A character in the room: where it is, where it goes, how far it has walked. */
export interface Actor {
  id: string;
  intern: boolean;
  x: number;
  y: number;
  /** Waypoints still to walk; empty when standing still. */
  path: Point[];
  target: Target;
  /** Client ms spent walking (drives the walk frame). */
  walkedMs: number;
  /** Walked out of the door (ended): not drawn. */
  gone: boolean;
  /** Cheers while `timeMs < cheerUntil` (R8). */
  cheerUntil: number;
}

/**
 * Next actors for `targets` (R4): a new id stands at its target on the `first` sync (gone
 * already if that is the door), later it walks in from the door; a known id whose target
 * spot changed walks there from where it is; ids without a target are dropped.
 */
export function syncActors(
  prev: ReadonlyMap<string, Actor>,
  targets: ReadonlyMap<string, Target>,
  interns: ReadonlySet<string>,
  first: boolean,
  grid: Grid,
): Map<string, Actor> {
  const door = spotOf('door');
  const next = new Map<string, Actor>();
  for (const [id, t] of targets) {
    const old = prev.get(id);
    const toDoor = t.spot === door.name;
    if (old === undefined) {
      const actor: Actor = first
        ? { id, intern: interns.has(id), x: t.x, y: t.y, path: [], target: t, walkedMs: 0, gone: toDoor, cheerUntil: 0 }
        : {
            id,
            intern: interns.has(id),
            x: door.x,
            y: door.y,
            path: findPath(grid, door, t),
            target: t,
            walkedMs: 0,
            gone: false,
            cheerUntil: 0,
          };
      next.set(id, actor);
      continue;
    }
    if (old.target.spot === t.spot) {
      next.set(id, { ...old, intern: interns.has(id), target: t });
      continue;
    }
    // Back from the door: walk in again from it.
    const from: Point = old.gone ? door : { x: old.x, y: old.y };
    next.set(id, {
      ...old,
      intern: interns.has(id),
      x: from.x,
      y: from.y,
      path: findPath(grid, from, t),
      target: t,
      gone: false,
    });
  }
  return next;
}

/** Moves every walking actor by `dtMs` (reduced: straight to the end, R5); true if anyone moved. */
export function stepActors(actors: ReadonlyMap<string, Actor>, dtMs: number, reduced: boolean): boolean {
  let moved = false;
  for (const a of actors.values()) {
    if (a.path.length === 0) continue;
    moved = true;
    if (reduced) {
      const end = a.path[a.path.length - 1] ?? a;
      a.x = end.x;
      a.y = end.y;
      a.path = [];
    } else {
      let budget = (WALK_PX_PER_S * dtMs) / 1000;
      a.walkedMs += dtMs;
      while (budget > 0 && a.path.length > 0) {
        const p = a.path[0] ?? a;
        const d = Math.hypot(p.x - a.x, p.y - a.y);
        if (d <= budget) {
          a.x = p.x;
          a.y = p.y;
          a.path.shift();
          budget -= d;
        } else {
          a.x += ((p.x - a.x) / d) * budget;
          a.y += ((p.y - a.y) / d) * budget;
          budget = 0;
        }
      }
    }
    if (a.path.length === 0 && a.target.spot === 'door') a.gone = true;
  }
  return moved;
}

/** Draw state of an actor: frame rect, sort key (feet y) and pose frame (null: idle frame). */
export interface ActorFrame extends Rect {
  sortY: number;
  frame: string | null;
}

/** True if the actor stands on its target (arrived). */
export function arrived(a: Actor): boolean {
  return a.path.length === 0 && a.x === a.target.x && a.y === a.target.y;
}

/**
 * Rect, sortY and pose frame of an actor at `timeMs` (R4, R8): the seat drop applies only
 * once arrived; `walk<n>` while walking (never with reduced motion), `cheer<n>` while
 * cheering, `head` with its head on the desk, else null (the caller uses `idleFrame`).
 */
export function actorFrame(a: Actor, timeMs: number, reduced: boolean): ActorFrame {
  const at = arrived(a);
  const kind: SpotKind = at ? spotOf(a.target.spot).kind : 'stand';
  const rect = characterFrame({ ...spotOf(a.target.spot), x: a.x, y: a.y, kind }, a.intern);
  let frame: string | null = null;
  if (a.path.length > 0 && !reduced) {
    frame = WALK_FRAME_NAMES[Math.floor(a.walkedMs / WALK_FRAME_MS) % WALK_FRAMES] ?? null;
  } else if (timeMs < a.cheerUntil) {
    frame = CHEER_FRAME_NAMES[reduced ? 0 : Math.floor(timeMs / CHEER_FRAME_MS) % CHEER_FRAME_NAMES.length] ?? null;
  } else if (at && a.target.pose === 'headDown') {
    frame = HEAD_FRAME;
  }
  return { ...rect, sortY: a.y, frame };
}
