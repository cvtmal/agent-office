import { describe, expect, it } from 'vitest';
import { PROPS, SPOTS, spot } from '../layout.js';
import { BACK_WALL_Y, CELL } from './constants.js';
import { buildGrid, cellCentre, cellOf, GRID_COLS, GRID_ROWS, walkable } from './grid.js';

const grid = buildGrid();

describe('buildGrid', () => {
  it('covers the scene in 8 px cells', () => {
    expect([grid.cols, grid.rows, grid.blocked.length]).toEqual([60, 34, 60 * 34]);
    expect([GRID_COLS, GRID_ROWS, CELL]).toEqual([60, 34, 8]);
  });

  it('blocks the back wall but not the door cell', () => {
    for (let row = 0; row * CELL < BACK_WALL_Y; row++) {
      for (let col = 0; col < grid.cols; col++) expect(walkable(grid, col, row)).toBe(false);
    }
    const door = cellOf(spot('door').x, spot('door').y);
    expect(walkable(grid, door.col, door.row)).toBe(true);
  });

  it('blocks the floor band of a desk prop', () => {
    const desk = PROPS.find((p) => p.slot === 'desk:A-lead');
    expect(desk).toBeDefined();
    const sortY = desk?.sortY ?? 0;
    // Left edge of the desk, just above its sortY: inside the band, not a spot's foot cell.
    const c = cellOf((desk?.x ?? 0) + 1, sortY - 4);
    expect(walkable(grid, c.col, c.row)).toBe(false);
    const centre = cellOf(spot('A-lead').x, sortY - 12);
    expect(walkable(grid, centre.col, centre.row)).toBe(false);
  });

  it("never blocks the rows below a spot's foot row with that spot's own props", () => {
    // papers:cto ends at sortY = cto.y + 3; the cell under the cto foot cell stays open.
    const c = cellOf(spot('cto').x, spot('cto').y);
    expect(walkable(grid, c.col, c.row + 1)).toBe(true);
  });

  it('keeps every spot foot cell open', () => {
    for (const s of SPOTS) {
      const c = cellOf(s.x, s.y);
      expect(walkable(grid, c.col, c.row), s.name).toBe(true);
    }
  });

  it('treats cells out of range as not walkable', () => {
    expect(walkable(grid, -1, 20)).toBe(false);
    expect(walkable(grid, 60, 20)).toBe(false);
    expect(walkable(grid, 20, -1)).toBe(false);
    expect(walkable(grid, 20, 34)).toBe(false);
  });

  it('maps points to cells and back to centres', () => {
    expect(cellOf(0, 0)).toEqual({ col: 0, row: 0 });
    expect(cellOf(479, 269)).toEqual({ col: 59, row: 33 });
    expect(cellCentre(2, 3)).toEqual({ x: 20, y: 28 });
  });
});
