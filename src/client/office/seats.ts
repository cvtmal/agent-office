// Seat assignment (research §Q4, OFFICE-2): pure, deterministic and sticky. Live
// characters are placed before ended ones, so an ended character never takes a seat
// from a live one; `previous` keeps a character where it was while still valid. DOM-free.
import type { Character } from '../../shared/types.js';
import type { Spot } from './layout.js';

/** What `assignSeats` needs of a character. */
export type SeatCharacter = Pick<
  Character,
  'id' | 'kind' | 'role' | 'status' | 'lane' | 'parentId' | 'lastActivityAt'
>;

/** Result: character id -> spot name, and the ids that found no spot (counted, not drawn). */
export interface SeatResult {
  seats: Map<string, string>;
  overflow: string[];
}

const isEnded = (c: SeatCharacter): boolean => c.status === 'ended';
const time = (c: SeatCharacter): number => (c.lastActivityAt === null ? -Infinity : Date.parse(c.lastActivityAt));

/** Non-ended first, then newest `lastActivityAt`, ties by id. */
function byPriority(a: SeatCharacter, b: SeatCharacter): number {
  const ended = Number(isEnded(a)) - Number(isEnded(b));
  if (ended !== 0) return ended;
  const t = time(b) - time(a);
  if (t !== 0 && !Number.isNaN(t)) return t;
  return a.id < b.id ? -1 : a.id > b.id ? 1 : 0;
}

/** May character `c` sit at `s` at all (used to keep `previous` seats)? */
function allowed(c: SeatCharacter, s: Spot): boolean {
  if (c.kind === 'agent') return s.kind === 'intern' || s.kind === 'stand';
  if (s.kind === 'open') return true;
  if (c.role === 'cto') return s.kind === 'cto';
  if (c.lane !== null) return s.kind === 'desk' && s.group === c.lane.letter;
  return false;
}

const dist = (a: Spot, b: Spot): number => Math.hypot(a.x - b.x, a.y - b.y);

/**
 * Assigns each character a spot. Order: CTO-role (newest live one -> `cto`, others ->
 * open desks); lane sessions -> their group's lead, then second desk, then open; other
 * sessions -> open desks in order; agents -> a free intern spot of the parent's desk
 * (any intern spot of the group for a group desk), else the nearest free intern/stand
 * spot, else overflow. Each step runs first for live, then for ended characters.
 */
export function assignSeats(
  characters: readonly SeatCharacter[],
  spots: readonly Spot[],
  previous?: ReadonlyMap<string, string>,
): SeatResult {
  const byName = new Map(spots.map((s) => [s.name, s]));
  const taken = new Set<string>();
  const seats = new Map<string, string>();
  const overflow: string[] = [];

  const take = (c: SeatCharacter, s: Spot | undefined): boolean => {
    if (s === undefined || taken.has(s.name)) return false;
    taken.add(s.name);
    seats.set(c.id, s.name);
    return true;
  };
  const free = (pred: (s: Spot) => boolean): Spot | undefined => spots.find((s) => !taken.has(s.name) && pred(s));
  const openDesk = (c: SeatCharacter): boolean => take(c, free((s) => s.kind === 'open'));

  const sticky = (list: readonly SeatCharacter[]): void => {
    for (const c of list) {
      const name = previous?.get(c.id);
      const s = name === undefined ? undefined : byName.get(name);
      if (s !== undefined && allowed(c, s)) take(c, s);
    }
  };

  let ctoClaimed = false;
  const placeSession = (c: SeatCharacter): boolean => {
    if (c.role === 'cto') {
      if (!isEnded(c) && !ctoClaimed) {
        ctoClaimed = true;
        if (take(c, free((s) => s.kind === 'cto'))) return true;
      }
      return openDesk(c);
    }
    if (c.lane !== null) {
      const letter = c.lane.letter;
      return (
        take(c, free((s) => s.kind === 'desk' && s.group === letter && s.slot === 'lead')) ||
        take(c, free((s) => s.kind === 'desk' && s.group === letter && s.slot === 'second')) ||
        openDesk(c)
      );
    }
    return openDesk(c);
  };

  const placeAgent = (c: SeatCharacter): boolean => {
    const parentSeat = c.parentId === null ? undefined : seats.get(c.parentId);
    const parent = parentSeat === undefined ? undefined : byName.get(parentSeat);
    if (parent !== undefined) {
      if (take(c, free((s) => s.kind === 'intern' && s.desk === parent.name))) return true;
      if (parent.group !== undefined && take(c, free((s) => s.kind === 'intern' && s.group === parent.group))) {
        return true;
      }
      const near = spots
        .filter((s) => !taken.has(s.name) && (s.kind === 'intern' || s.kind === 'stand'))
        .sort((a, b) => dist(a, parent) - dist(b, parent));
      return take(c, near[0]);
    }
    return take(c, free((s) => s.kind === 'stand')) || take(c, free((s) => s.kind === 'intern'));
  };

  const sorted = [...characters].sort(byPriority);
  const sessions = sorted.filter((c) => c.kind === 'session');
  const agents = sorted.filter((c) => c.kind === 'agent');
  // Sessions in role order: CTO-role, lane sessions, the rest (stable within each by priority).
  const rank = (c: SeatCharacter): number => (c.role === 'cto' ? 0 : c.lane !== null ? 1 : 2);
  const ordered = [...sessions].sort((a, b) => rank(a) - rank(b) || byPriority(a, b));

  for (const ended of [false, true]) {
    const mine = (c: SeatCharacter): boolean => isEnded(c) === ended;
    sticky([...ordered.filter(mine), ...agents.filter(mine)]);
    for (const c of ordered.filter(mine)) if (!seats.has(c.id) && !placeSession(c)) overflow.push(c.id);
    for (const c of agents.filter(mine)) if (!seats.has(c.id) && !placeAgent(c)) overflow.push(c.id);
  }
  return { seats, overflow };
}
