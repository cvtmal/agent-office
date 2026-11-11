import { describe, expect, it } from 'vitest';
import { PLANNED_SPRITES } from '../../office/layout.js';
import { SPRITES as KITCHEN } from './kitchen.js';
import { SPRITES as WALL } from './wall.js';

const WALL_IDS = [
  'whiteboard',
  'done-frame',
  'done-frame-empty',
  'done-sign',
  'shelf-books',
  'shelf-binders',
  'poster-map',
  'poster-rocket',
  'poster-wave',
  'sticky-notes',
  'clock',
  'neon-sign',
  'fairy-lights',
  'plant-hanging',
  'cables',
];

const KITCHEN_IDS = [
  'counter',
  'coffee-machine',
  'couch',
  'rug-kitchen',
  'plant-small',
  'plant-floor',
  'fridge',
  'boxes',
  'bin',
  'kettle',
];

/** Palette colours used by a sprite. */
const coloursOf = (s: (typeof WALL)[number]): Set<string> =>
  new Set([...new Set(s.grid.join(''))].filter((ch) => ch !== '.').map((ch) => s.key[ch] ?? '?'));

const byId = (id: string): (typeof WALL)[number] => {
  const s = [...WALL, ...KITCHEN].find((d) => d.id === id);
  if (s === undefined) throw new Error(id);
  return s;
};

describe('wall and kitchen props (plan steps 8.1-8.2)', () => {
  it('have the manifests of steps 8.1 and 8.2', () => {
    expect(WALL.map((s) => s.id)).toEqual(WALL_IDS);
    expect(KITCHEN.map((s) => s.id)).toEqual(KITCHEN_IDS);
  });

  it('have the sizes office/layout.ts places them with', () => {
    for (const s of [...WALL, ...KITCHEN]) expect([s.w, s.h], s.id).toEqual(PLANNED_SPRITES[s.id]);
  });

  it('neon props glow in the neon ramp; the coffee machine has a lit lamp-cream indicator', () => {
    const neon = coloursOf(byId('neon-sign'));
    expect(neon.has('neon0') && neon.has('neon1')).toBe(true);
    expect([...coloursOf(byId('fairy-lights'))].some((c) => c.startsWith('neon'))).toBe(true);
    expect(coloursOf(byId('coffee-machine')).has('lamp2')).toBe(true);
  });

  it('the done frame differs from the empty one inside the same wood frame', () => {
    const full = byId('done-frame').grid;
    const empty = byId('done-frame-empty').grid;
    expect(full).not.toEqual(empty);
    expect(full[0]).toBe(empty[0]);
    expect(full.at(-1)).toBe(empty.at(-1));
  });
});
