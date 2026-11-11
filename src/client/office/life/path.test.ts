import { describe, expect, it } from 'vitest';
import { SPOTS, spot } from '../layout.js';
import { buildGrid, cellOf, walkable, type Grid, type Point } from './grid.js';
import { findPath, pathLength, unreachableCount } from './path.js';

const grid = buildGrid();
const door = spot('door');

/** No spot is unreachable: a spot's own props never block below its foot row (the cto seat fix). */
const KNOWN_UNREACHABLE: string[] = [];

/** Every 1 px sample along the path from `from` lies in a walkable cell (or the start/goal cell). */
function crossesBlocked(g: Grid, from: Point, path: readonly Point[]): boolean {
  const ends = new Set([cellOf(from.x, from.y), cellOf(path.at(-1)?.x ?? 0, path.at(-1)?.y ?? 0)].map((c) => `${String(c.col)},${String(c.row)}`));
  let at = from;
  for (const p of path) {
    const n = Math.ceil(Math.hypot(p.x - at.x, p.y - at.y));
    for (let i = 0; i <= n; i++) {
      const t = n === 0 ? 1 : i / n;
      const c = cellOf(at.x + (p.x - at.x) * t, at.y + (p.y - at.y) * t);
      if (!walkable(g, c.col, c.row) && !ends.has(`${String(c.col)},${String(c.row)}`)) return true;
    }
    at = p;
  }
  return false;
}

describe('findPath', () => {
  it('reaches every spot from the door except the known blocker', () => {
    const unreachable: string[] = [];
    for (const s of SPOTS) {
      const before = unreachableCount;
      const path = findPath(grid, door, s);
      if (unreachableCount > before) unreachable.push(s.name);
      expect(path.at(-1)).toEqual({ x: s.x, y: s.y });
    }
    expect(unreachable).toEqual(KNOWN_UNREACHABLE);
  });

  it('never crosses a blocked cell', () => {
    for (const s of SPOTS) {
      if (KNOWN_UNREACHABLE.includes(s.name)) continue;
      expect(crossesBlocked(grid, door, findPath(grid, door, s)), s.name).toBe(false);
      expect(crossesBlocked(grid, s, findPath(grid, s, door)), `${s.name} back`).toBe(false);
    }
  });

  it('is deterministic', () => {
    for (const s of SPOTS) expect(findPath(buildGrid(), door, s)).toEqual(findPath(grid, door, s));
  });

  it('gives one waypoint for a straight corridor and for the same cell', () => {
    expect(findPath(grid, { x: 124, y: 132 }, { x: 300, y: 132 })).toEqual([{ x: 300, y: 132 }]);
    expect(findPath(grid, { x: 121, y: 133 }, { x: 123, y: 134 })).toEqual([{ x: 123, y: 134 }]);
  });

  it('collapses runs to their corners', () => {
    const path = findPath(grid, door, spot('kitchen-4'));
    expect(path.length).toBeGreaterThan(1);
    expect(path.length).toBeLessThan(10);
    expect(pathLength(door, path)).toBeGreaterThanOrEqual(Math.hypot(400 - door.x, 176 - door.y));
  });

  it('jumps and counts when there is no path', () => {
    const closed: Grid = { cols: 60, rows: 34, blocked: new Uint8Array(60 * 34).fill(1) };
    const before = unreachableCount;
    expect(findPath(closed, { x: 4, y: 4 }, { x: 100, y: 100 })).toEqual([{ x: 100, y: 100 }]);
    expect(unreachableCount).toBe(before + 1);
  });
});
