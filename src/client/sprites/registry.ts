// All sprite families in one place (plan step 1.6): the atlas packs them, the
// preview test draws them, the registry test checks them. DOM-free.
import { rasterize, type Raster } from '../render/raster.js';
import { charactersFamily } from './characters/index.js';
import { internsFamily } from './interns/index.js';
import { propsFamily } from './props/index.js';
import { shellFamily } from './shell/index.js';
import { tilesFamily } from './tiles/index.js';
import type { Family, SpriteDef } from './types.js';

/** Every sprite family, in preview and packing order. */
export const FAMILIES: readonly Family[] = [tilesFamily, shellFamily, propsFamily, charactersFamily, internsFamily];

const BY_ID = new Map<string, SpriteDef>(FAMILIES.flatMap((f) => f.sprites.map((s) => [s.id, s])));

/** The sprite with this id, or undefined if no family has it. */
export function spriteById(id: string): SpriteDef | undefined {
  return BY_ID.get(id);
}

/** A sprite's pixels, optionally recoloured (palette name -> palette name). */
export function rasterizeSprite(def: SpriteDef, recolour?: Readonly<Record<string, string>>): Raster {
  return rasterize(def.grid, def.key, recolour, def.id);
}
