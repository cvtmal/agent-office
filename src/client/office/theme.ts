// Room themes (plan P-7): the template is the same for every project; a theme picks
// tile variants, an accent ramp, the light tints, its own always-on lights, recolours
// of background sprites and a few prop swaps per layout slot.
// `themeFor` hashes the project id, so a room keeps its theme across reloads. DOM-free.
import { fnv1a } from '../render/hash.js';
import type { RampName } from '../render/palette.js';
import type { TileKind } from './layout.js';

/** Theme names. */
export type ThemeName = 'nerd' | 'neon';

/** One room theme. */
export interface Theme {
  name: ThemeName;
  /** Tile sprite id per tile kind of `layout.tileKind`. */
  tiles: Readonly<Record<TileKind, string>>;
  /** Accent ramp of the room (props, trims). */
  accent: RampName;
  /** Palette colour the light layer is filled with (the night tint, multiplied). */
  nightTint: string;
  /** Palette colour of the warmest band of a lamp pool. */
  lampTint: string;
  /** Prop slot -> sprite id to draw instead of the layout default, or `null` to leave the slot empty. */
  swaps: Readonly<Record<string, string | null>>;
  /** Always-on lights of the theme's own props (ids of `layout.THEME_LIGHTS`). */
  lights: readonly string[];
  /** Sprite id -> palette recolour (name -> name), applied wherever the room draws that sprite. */
  recolour: Readonly<Record<string, Readonly<Record<string, string>>>>;
}

/** The kitchen checker is quieter with its light squares one step darker (night4 -> night3). */
const QUIET_KITCHEN: Readonly<Record<string, Readonly<Record<string, string>>>> = {
  'floor-kitchen': { night4: 'night3' },
};

const BASE_TILES: Readonly<Record<TileKind, string>> = {
  ceiling: 'ceiling-flat',
  'slope-l': 'ceiling-slope-l',
  'slope-r': 'ceiling-slope-r',
  wall: 'wall-nerd',
  skirting: 'wall-skirting',
  floor: 'floor-wood-a',
  carpet: 'floor-carpet',
  kitchen: 'floor-kitchen',
};

/** Warm wood, books and maps; no fairy lights or loose cables. */
export const NERD: Theme = {
  name: 'nerd',
  tiles: BASE_TILES,
  accent: 'wood',
  nightTint: 'night3',
  lampTint: 'lamp1',
  swaps: {
    'wall-string': null,
    'floor-cables': null,
  },
  lights: [],
  recolour: QUIET_KITCHEN,
};

/** Magenta and cyan tubes, fairy lights, cables. */
export const NEON: Theme = {
  name: 'neon',
  tiles: { ...BASE_TILES, wall: 'wall-neon', floor: 'floor-wood-b' },
  accent: 'neon',
  // night2 sank the unlit desk groups into near-black (Phase 9 round 1); the neon room
  // keeps the nerd room's tint and gets its mood from the sign, the string and the walls.
  nightTint: 'night3',
  lampTint: 'lamp0',
  swaps: {
    'wall-deco-1': 'poster-wave',
    'wall-deco-2': 'neon-sign',
    'wall-deco-3': 'poster-rocket',
    'kitchen-shelf': 'shelf-binders',
    'cto-shelf': 'shelf-books',
  },
  lights: ['neon:sign', 'neon:fairy'],
  recolour: QUIET_KITCHEN,
};

/** Every theme, indexed by `fnv1a(projectId) % THEMES.length`. */
export const THEMES: readonly Theme[] = [NERD, NEON];

/** The theme of a project (harbor -> nerd, notes-app -> neon with the sample ids). */
export function themeFor(projectId: string): Theme {
  return THEMES[fnv1a(projectId) % THEMES.length] ?? NERD;
}

/** The sprite of a prop slot under a theme: the swap if any (`null` = hidden), else the default. */
export function themedSprite(theme: Theme, slot: string, sprite: string): string | null {
  return slot in theme.swaps ? (theme.swaps[slot] ?? null) : sprite;
}
