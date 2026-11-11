import { describe, expect, it } from 'vitest';
import { shellFamily } from '../shell/index.js';
import { tilesFamily } from './index.js';

const TILE_IDS = [
  'floor-wood-a',
  'floor-wood-b',
  'floor-carpet',
  'floor-kitchen',
  'wall-nerd',
  'wall-neon',
  'wall-skirting',
  'ceiling-slope-l',
  'ceiling-slope-r',
  'ceiling-flat',
  'beam',
  'partition-v',
  'partition-h',
];

/** Tiles that lie over another tile and so have transparent pixels. */
const OVERLAYS = new Set(['wall-skirting', 'ceiling-slope-l', 'ceiling-slope-r', 'beam', 'partition-v', 'partition-h']);

describe('tiles', () => {
  it('has the manifest of step 3.1, all 16x16', () => {
    expect(tilesFamily.sprites.map((s) => s.id)).toEqual(TILE_IDS);
    for (const s of tilesFamily.sprites) expect([s.w, s.h]).toEqual([16, 16]);
  });

  it('floors, walls and the flat ceiling are fully opaque (they repeat edge to edge)', () => {
    for (const s of tilesFamily.sprites.filter((t) => !OVERLAYS.has(t.id))) {
      expect(s.grid.join('').includes('.'), s.id).toBe(false);
    }
  });

  it('the right ceiling slope mirrors the left one', () => {
    const l = tilesFamily.sprites.find((s) => s.id === 'ceiling-slope-l');
    const r = tilesFamily.sprites.find((s) => s.id === 'ceiling-slope-r');
    expect(r?.grid).toEqual(l?.grid.map((row) => [...row].reverse().join('')));
  });
});

describe('shell', () => {
  it('has window-night 80x48, door 32x56, wall-trim 16x4, all opaque', () => {
    expect(shellFamily.sprites.map((s) => [s.id, s.w, s.h])).toEqual([
      ['window-night', 80, 48],
      ['door', 32, 56],
      ['wall-trim', 16, 4],
    ]);
    for (const s of shellFamily.sprites) expect(s.grid.join('').includes('.'), s.id).toBe(false);
  });
});
