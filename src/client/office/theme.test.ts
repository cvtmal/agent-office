import { describe, expect, it } from 'vitest';
import { PALETTE, RAMPS } from '../render/palette.js';
import { spriteById } from '../sprites/registry.js';
import { PROPS, THEME_LIGHTS } from './layout.js';
import { NEON, NERD, THEMES, themeFor, themedSprite } from './theme.js';

const known = (id: string): boolean => spriteById(id) !== undefined;

describe('themeFor', () => {
  it('maps the sample rooms to different themes: harbor nerd, notes-app neon', () => {
    expect(themeFor('/home/demo/code/harbor').name).toBe('nerd');
    expect(themeFor('/home/demo/code/notes-app').name).toBe('neon');
    expect(themeFor('/home/demo/code/harbor')).toBe(themeFor('/home/demo/code/harbor'));
  });
});

describe('THEMES', () => {
  const slots = new Set(PROPS.map((p) => p.slot));

  it('swap only existing layout prop slots, with known sprites', () => {
    for (const t of THEMES) {
      for (const [slot, sprite] of Object.entries(t.swaps)) {
        expect(slots.has(slot), `${t.name}: ${slot}`).toBe(true);
        if (sprite !== null) expect(known(sprite), `${t.name}: ${sprite}`).toBe(true);
      }
    }
  });

  it('use known tile sprites and palette colours', () => {
    for (const t of THEMES) {
      for (const id of Object.values(t.tiles)) expect(known(id), id).toBe(true);
      expect(t.accent in RAMPS).toBe(true);
      expect(PALETTE[t.nightTint]).toBeDefined();
      expect(PALETTE[t.lampTint]).toBeDefined();
    }
  });

  it('light only their own theme props, and recolour known sprites with palette names', () => {
    for (const t of THEMES) {
      for (const id of t.lights) {
        const [slot, sprite] = THEME_LIGHTS[id] ?? ['', ''];
        const def = PROPS.find((p) => p.slot === slot)?.sprite ?? '';
        expect(themedSprite(t, slot, def), `${t.name}: ${id}`).toBe(sprite);
      }
      for (const [id, map] of Object.entries(t.recolour)) {
        expect(known(id), id).toBe(true);
        for (const [from, to] of Object.entries(map)) {
          expect(PALETTE[from], from).toBeDefined();
          expect(PALETTE[to], to).toBeDefined();
        }
      }
    }
    expect(NEON.lights).toEqual(['neon:sign', 'neon:fairy']);
    expect(NERD.lights).toEqual([]);
  });

  it('differ: neon walls, sign and fairy lights; nerd without them', () => {
    expect(NEON.tiles.wall).not.toBe(NERD.tiles.wall);
    expect(themedSprite(NEON, 'wall-deco-2', 'poster-map')).toBe('neon-sign');
    expect(themedSprite(NERD, 'wall-deco-2', 'poster-map')).toBe('poster-map');
    expect(themedSprite(NEON, 'wall-string', 'fairy-lights')).toBe('fairy-lights');
    expect(themedSprite(NERD, 'wall-string', 'fairy-lights')).toBeNull();
  });
});
