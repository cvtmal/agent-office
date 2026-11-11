// Walk grid of the room (research R1): 8 px cells over the 480x270 scene. Blocked are
// the back wall (except the door cell) and the floor band of every y-sorted prop; the
// foot cell of every named spot is forced walkable so it can be a path end, and a spot's own
// props never block the rows below its foot row. DOM-free.
import { PROPS, SCENE_H, SCENE_W, SPOTS, spriteSize, type Prop, type Spot } from '../layout.js';
import { BACK_WALL_Y, CELL } from './constants.js';

/** A point in scene px. */
export interface Point {
  x: number;
  y: number;
}

/** Grid columns and rows (60 x 34; the last row is cropped by the scene edge). */
export const GRID_COLS = 60;
export const GRID_ROWS = 34;

/** The walk grid: `blocked[row * cols + col]` is 1 for a cell nobody walks through. */
export interface Grid {
  cols: typeof GRID_COLS;
  rows: typeof GRID_ROWS;
  blocked: Uint8Array;
}

// The grid covers the scene exactly.
if (GRID_COLS * CELL !== SCENE_W || GRID_ROWS !== Math.ceil(SCENE_H / CELL)) {
  throw new Error('walk grid does not match the scene size');
}

/** Cell (col, row) of a scene point. */
export function cellOf(x: number, y: number): { col: number; row: number } {
  return { col: Math.floor(x / CELL), row: Math.floor(y / CELL) };
}

/** Centre point of a cell. */
export function cellCentre(col: number, row: number): Point {
  return { x: col * CELL + CELL / 2, y: row * CELL + CELL / 2 };
}

const inRange = (grid: Grid, col: number, row: number): boolean =>
  col >= 0 && row >= 0 && col < grid.cols && row < grid.rows;

/** True if the cell is inside the grid and not blocked. */
export function walkable(grid: Grid, col: number, row: number): boolean {
  return inRange(grid, col, row) && grid.blocked[row * grid.cols + col] === 0;
}

/** Most px of a prop's height that block the floor above its sortY (its footprint band). */
const FOOTPRINT_MAX_H = 16;

/** Builds the walk grid from the room's props and spots. */
export function buildGrid(props: readonly Prop[] = PROPS, spots: readonly Spot[] = SPOTS): Grid {
  const grid: Grid = { cols: GRID_COLS, rows: GRID_ROWS, blocked: new Uint8Array(GRID_COLS * GRID_ROWS) };
  const set = (col: number, row: number, v: 0 | 1): void => {
    if (inRange(grid, col, row)) grid.blocked[row * grid.cols + col] = v;
  };

  const wallRows = Math.ceil(BACK_WALL_Y / CELL);
  for (let row = 0; row < wallRows; row++) for (let col = 0; col < grid.cols; col++) set(col, row, 1);
  const door = spots.find((s) => s.kind === 'door');
  if (door !== undefined) {
    const c = cellOf(door.x, door.y);
    set(c.col, c.row, 0);
  }

  const footRow = new Map(spots.map((s) => [s.name, cellOf(s.x, s.y).row]));
  for (const p of props) {
    if (p.layer !== 'sort') continue;
    const size = spriteSize(p.sprite);
    if (size === undefined) continue;
    const sortY = p.sortY ?? p.y + size.h;
    const top = sortY - Math.min(size.h, FOOTPRINT_MAX_H);
    const c0 = Math.floor(p.x / CELL);
    const c1 = Math.floor((p.x + size.w - 1) / CELL);
    const r0 = Math.floor(top / CELL);
    // A spot's own desk props never block the rows below its foot row, so its sitter can reach it
    // from the aisle (research R1: seat spots are path ends; the cto seat was boxed in).
    const own = p.spot === undefined ? undefined : footRow.get(p.spot);
    const r1 = Math.min(Math.floor((sortY - 1) / CELL), own === undefined ? Infinity : own);
    for (let row = r0; row <= r1; row++) for (let col = c0; col <= c1; col++) set(col, row, 1);
  }

  for (const s of spots) {
    const c = cellOf(s.x, s.y);
    set(c.col, c.row, 0);
  }
  return grid;
}
