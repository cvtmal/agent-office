// Sprite family `characters`: the paper-doll parts of agents (builds, heads,
// hair, faces, accessories, clothing overlays). The parts are drawn in their
// reference look here; compose.ts dresses them per look. DOM-free.
import type { Family } from '../types.js';
import { BUILDS, SHADOW } from './builds.js';
import { ACCESSORY_PARTS, FACE_PARTS, HAIRS, HEAD } from './heads.js';
import { OVERLAY_PARTS } from './overlays.js';

/** The `characters` family; preview sheet `var/sprites/characters.png`. */
export const charactersFamily: Family = {
  name: 'characters',
  sprites: [...BUILDS, SHADOW, ...OVERLAY_PARTS, HEAD, ...HAIRS, ...FACE_PARTS, ...ACCESSORY_PARTS],
};
