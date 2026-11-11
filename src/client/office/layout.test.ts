import { describe, expect, it } from 'vitest';
import { LANE_LETTERS } from '../../shared/constants.js';
import { spriteById } from '../sprites/registry.js';
import {
  COLS,
  LAMP_POINTS,
  PLANNED_SPRITES,
  PROPS,
  ROWS,
  SCENE_H,
  SCENE_W,
  SPOTS,
  THEME_LIGHTS,
  ZONES,
  characterFrame,
  spot,
  spriteSize,
  tileKind,
  type Rect,
  type Spot,
  type ZoneName,
} from './layout.js';

const inside = (r: Rect, outer: Rect): boolean =>
  r.x >= outer.x && r.y >= outer.y && r.x + r.w <= outer.x + outer.w && r.y + r.h <= outer.y + outer.h;
const overlaps = (a: Rect, b: Rect): boolean =>
  a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h;
const CANVAS: Rect = { x: 0, y: 0, w: SCENE_W, h: SCENE_H };

function zoneOf(s: Spot): ZoneName {
  if (s.group !== undefined) return `group${s.group}`;
  switch (s.kind) {
    case 'cto':
      return 'cto';
    case 'kitchen':
    case 'couch':
      return 'kitchen';
    case 'door':
      return 'aisleL';
    default:
      return 'open';
  }
}

const isIntern = (s: Spot): boolean => s.kind === 'intern';

describe('ZONES', () => {
  it('lie inside the canvas, and the floor zones do not overlap', () => {
    for (const z of Object.values(ZONES)) expect(inside(z, CANVAS)).toBe(true);
    // The aisles are walk space and cross the open area (P-2), so they are left out here.
    const floor = (['cto', 'groupA', 'groupB', 'groupC', 'groupD', 'open', 'kitchen'] as const).map(
      (n) => ZONES[n],
    );
    for (const [i, a] of floor.entries()) for (const b of floor.slice(i + 1)) expect(overlaps(a, b)).toBe(false);
    expect(ZONES.groupA).toEqual({ x: 128, y: 80, w: 112, h: 64 });
    expect(ZONES.open).toEqual({ x: 0, y: 208, w: 352, h: 62 });
  });
});

describe('SPOTS', () => {
  it('have unique names and are found by spot()', () => {
    expect(new Set(SPOTS.map((s) => s.name)).size).toBe(SPOTS.length);
    expect(spot('cto').kind).toBe('cto');
    expect(() => spot('nope')).toThrow(/nope/);
  });

  it('sit inside their zone, with their frame inside the canvas', () => {
    for (const s of SPOTS) {
      const zone = ZONES[zoneOf(s)];
      expect(inside({ x: s.x, y: s.y, w: 0, h: 0 }, zone), s.name).toBe(true);
      expect(inside(characterFrame(s, isIntern(s)), CANVAS), s.name).toBe(true);
    }
  });

  it('keep seated frames of desk-bound spots inside their zone', () => {
    for (const s of SPOTS.filter((x) => ['cto', 'desk', 'intern', 'open'].includes(x.kind))) {
      expect(inside(characterFrame(s, isIntern(s)), ZONES[zoneOf(s)]), s.name).toBe(true);
    }
  });

  it('never overlap the frames of two spots', () => {
    for (const [i, a] of SPOTS.entries()) {
      for (const b of SPOTS.slice(i + 1)) {
        expect(overlaps(characterFrame(a, isIntern(a)), characterFrame(b, isIntern(b))), `${a.name}/${b.name}`).toBe(
          false,
        );
      }
    }
  });

  it('have 4 groups of lead, second and 2 interns', () => {
    for (const g of LANE_LETTERS) {
      const names = SPOTS.filter((s) => s.group === g).map((s) => s.name);
      expect(names.sort()).toEqual([`${g}-intern-1`, `${g}-intern-2`, `${g}-lead`, `${g}-second`]);
      expect(spot(`${g}-lead`).slot).toBe('lead');
      expect(spot(`${g}-second`).slot).toBe('second');
      expect(spot(`${g}-intern-1`).desk).toBe(`${g}-lead`);
    }
  });

  it('have the open area, kitchen, couch, stand and door spots', () => {
    const names = new Set(SPOTS.map((s) => s.name));
    for (const n of [
      ...[1, 2, 3, 4, 5, 6].map((i) => `open-${String(i)}`),
      ...[1, 2, 3, 4].map((i) => `open-intern-${String(i)}`),
      ...[1, 2, 3, 4].map((i) => `kitchen-${String(i)}`),
      'stand-1',
      'stand-2',
      'couch-1',
      'couch-2',
      'door',
    ]) {
      expect(names.has(n), n).toBe(true);
    }
  });

  it('give each open intern spot its nearest open desk', () => {
    const opens = SPOTS.filter((s) => s.kind === 'open');
    for (const s of SPOTS.filter((x) => x.kind === 'intern' && x.group === undefined)) {
      const nearest = [...opens].sort((a, b) => Math.hypot(a.x - s.x, a.y - s.y) - Math.hypot(b.x - s.x, b.y - s.y));
      expect(s.desk, s.name).toBe(nearest[0]?.name);
      expect(Math.hypot((nearest[0]?.x ?? 0) - s.x, 0)).toBeLessThan(Math.hypot((nearest[1]?.x ?? 0) - s.x, 0));
    }
  });

  it('name a lamp for every desk-bearing spot', () => {
    for (const s of SPOTS.filter((x) => ['cto', 'desk', 'open'].includes(x.kind))) expect(s.lamp, s.name).toBeDefined();
    expect(spot('cto').lamp).toBe('lamp:cto');
    expect(spot('B-second').lamp).toBe('lamp:B-second');
  });
});

describe('PROPS', () => {
  it('have unique slots', () => {
    expect(new Set(PROPS.map((p) => p.slot)).size).toBe(PROPS.length);
  });

  it('use sprite ids that exist in the registry, at their planned sizes', () => {
    for (const p of PROPS) {
      for (const id of [p.sprite, ...(p.off === undefined ? [] : [p.off])]) {
        const def = spriteById(id);
        expect(def, `${p.slot}: ${id}`).toBeDefined();
        const planned = PLANNED_SPRITES[id];
        if (planned !== undefined) expect([def?.w, def?.h], id).toEqual([...planned]);
      }
    }
    for (const [id, [w, h]] of Object.entries(PLANNED_SPRITES)) expect(spriteSize(id), id).toEqual({ w, h });
  });

  it('turn every monitor screen towards its sitter (mirror on the right of a second desk)', () => {
    for (const s of SPOTS.filter((x) => x.kind === 'desk' || x.kind === 'open')) {
      const m = PROPS.find((p) => p.slot === `monitor:${s.name}`);
      const right = (m?.x ?? 0) > s.x;
      expect(m?.sprite, s.name).toBe(right ? 'monitor-l' : 'monitor');
      expect(m?.off, s.name).toBe(right ? 'monitor-off-l' : 'monitor-off');
      expect(right, s.name).toBe(s.slot === 'second');
    }
  });

  it('keep wall props clear of each other where they would touch (poster above the fridge)', () => {
    const rect = (slot: string): Rect => {
      const p = PROPS.find((q) => q.slot === slot);
      const size = spriteSize(p?.sprite ?? '') ?? { w: 0, h: 0 };
      return { x: p?.x ?? 0, y: p?.y ?? 0, w: size.w, h: size.h };
    };
    expect(overlaps(rect('wall-deco-2'), rect('fridge'))).toBe(false);
  });

  it('lie inside the canvas; sort props have a sortY, desk props a real spot', () => {
    for (const p of PROPS) {
      const size = spriteSize(p.sprite);
      expect(size, p.slot).toBeDefined();
      expect(inside({ x: p.x, y: p.y, w: size?.w ?? 0, h: size?.h ?? 0 }, CANVAS), p.slot).toBe(true);
      if (p.layer === 'sort') expect(p.sortY, p.slot).toBeTypeOf('number');
      if (p.spot !== undefined) expect(() => spot(p.spot ?? '')).not.toThrow();
    }
  });

  it('sort each desk front after its seated character and the chair before it', () => {
    for (const s of SPOTS.filter((x) => x.kind === 'desk' || x.kind === 'open' || x.kind === 'cto')) {
      expect(PROPS.find((p) => p.slot === `desk:${s.name}`)?.sortY).toBe(s.y + 1);
      expect(PROPS.find((p) => p.slot === `chair:${s.name}`)?.sortY).toBe(s.y - 1);
    }
  });

  it('place a monitor (glow) and a lamp at every desk, plus coffee and moon lights', () => {
    for (const s of SPOTS) {
      if (s.lamp === undefined) continue;
      expect(LAMP_POINTS.has(s.lamp), s.lamp).toBe(true);
      expect(LAMP_POINTS.has(`glow:${s.name}`), s.name).toBe(true);
    }
    expect(LAMP_POINTS.has('lamp:coffee')).toBe(true);
    expect(LAMP_POINTS.has('moon:window')).toBe(true);
  });

  it('give theme lights a point at the centre of their sprite in their slot', () => {
    for (const [id, [slot, sprite]] of Object.entries(THEME_LIGHTS)) {
      const p = PROPS.find((q) => q.slot === slot);
      const size = spriteSize(sprite);
      expect(p, slot).toBeDefined();
      expect(LAMP_POINTS.get(id)).toEqual({
        x: (p?.x ?? 0) + Math.floor((size?.w ?? 0) / 2),
        y: (p?.y ?? 0) + Math.floor((size?.h ?? 0) / 2),
      });
    }
  });
});

describe('tileKind', () => {
  it('covers the grid with ceiling, wall and floors by zone', () => {
    expect(tileKind(0, 0)).toBe('ceiling');
    expect(tileKind(COLS - 1, 0)).toBe('ceiling');
    expect(tileKind(1, 0)).toBe('slope-l');
    expect(tileKind(COLS - 2, 0)).toBe('slope-r');
    expect(tileKind(0, 1)).toBe('slope-l');
    expect(tileKind(COLS - 1, 1)).toBe('slope-r');
    expect(tileKind(10, 0)).toBe('ceiling');
    expect(tileKind(10, 2)).toBe('wall');
    expect(tileKind(10, 4)).toBe('skirting');
    expect(tileKind(2, 6)).toBe('carpet');
    expect(tileKind(25, 10)).toBe('kitchen');
    expect(tileKind(10, ROWS - 1)).toBe('floor');
  });
});
