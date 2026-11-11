// Paths on the walk grid (research R1, Alternative D): breadth-first search over the
// 4 neighbours in the fixed order N, E, S, W, so the same query always gives the same
// path. Waypoints are the corners of straight runs; the last one is the goal. DOM-free.
import { cellCentre, cellOf, walkable, type Grid, type Point } from './grid.js';

/** Neighbour offsets in search order: N, E, S, W. */
const STEPS: readonly (readonly [number, number])[] = [
  [0, -1],
  [1, 0],
  [0, 1],
  [-1, 0],
];

/** How many queries found no path (the walker then jumps); read by tests and e2e. */
export let unreachableCount = 0;

/**
 * Waypoints from `from` to `to`: cell centres where the path turns, then exactly `to`.
 * Same cell -> `[to]`; no path -> `[to]` (a jump) and `unreachableCount` + 1.
 */
export function findPath(grid: Grid, from: Point, to: Point): Point[] {
  const a = cellOf(from.x, from.y);
  const b = cellOf(to.x, to.y);
  const start = a.row * grid.cols + a.col;
  const goal = b.row * grid.cols + b.col;
  if (start === goal) return [{ x: to.x, y: to.y }];

  const prev = new Int32Array(grid.cols * grid.rows).fill(-1);
  prev[start] = start;
  const queue: number[] = [start];
  let found = false;
  for (let head = 0; head < queue.length; head++) {
    const cur = queue[head] ?? 0;
    if (cur === goal) {
      found = true;
      break;
    }
    const col = cur % grid.cols;
    const row = (cur - col) / grid.cols;
    for (const [dc, dr] of STEPS) {
      const nc = col + dc;
      const nr = row + dr;
      const next = nr * grid.cols + nc;
      if (next !== goal && !walkable(grid, nc, nr)) continue;
      if (nc < 0 || nr < 0 || nc >= grid.cols || nr >= grid.rows || (prev[next] ?? 0) !== -1) continue;
      prev[next] = cur;
      queue.push(next);
    }
  }
  if (!found) {
    unreachableCount++;
    return [{ x: to.x, y: to.y }];
  }

  const cells: number[] = [];
  for (let c = goal; c !== start; c = prev[c] ?? start) cells.push(c);
  cells.push(start);
  cells.reverse();

  const points: Point[] = [];
  for (let i = 1; i < cells.length - 1; i++) {
    const p = cells[i - 1] ?? 0;
    const c = cells[i] ?? 0;
    const n = cells[i + 1] ?? 0;
    if (c - p !== n - c) {
      const col = c % grid.cols;
      points.push(cellCentre(col, (c - col) / grid.cols));
    }
  }
  points.push({ x: to.x, y: to.y });
  return points;
}

/** Length in px of walking `path` from `from`. */
export function pathLength(from: Point, path: readonly Point[]): number {
  let len = 0;
  let at = from;
  for (const p of path) {
    len += Math.hypot(p.x - at.x, p.y - at.y);
    at = p;
  }
  return len;
}
