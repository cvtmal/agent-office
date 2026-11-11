// The look space (plan P-5): how many variants each look field has. The contract
// between `office/look.ts` (which hashes ids into it) and the character sprites
// (which must provide that many variants). DOM-free.

/** Look fields, in the order and with the exact keys `lookFor` hashes (`fnv1a(id + ':' + field)`). */
export const LOOK_FIELDS = ['build', 'skin', 'hair', 'hairRamp', 'face', 'palette', 'accessory', 'overlay'] as const;

/** One look field name. */
export type LookField = (typeof LOOK_FIELDS)[number];

/** Skin ramps of `render/palette.ts`, by look index. */
export const SKINS = ['skinA', 'skinB', 'skinC'] as const;

/** Hair colours, by look index (P-6: night, wood, lamp, cloth orange, night lavender). */
export const HAIR_RAMPS = ['black', 'brown', 'blonde', 'ginger', 'grey'] as const;

/** Face extras, by look index. */
export const FACES = ['none', 'glasses', 'beard', 'glasses+beard'] as const;

/** Accessories of agents, by look index. */
export const ACCESSORIES = ['none', 'headphones', 'cap', 'beanie', 'hoops'] as const;

/** Accessories of interns, by look index (a different list from agents). */
export const INTERN_ACCESSORIES = ['none', 'cap', 'headphones'] as const;

/** Clothing overlays, by look index. */
export const OVERLAYS = ['none', 'tie', 'hoodie-strings', 'open-jacket'] as const;

/** Variant count per look field for agents (32x48 frames). */
export const AGENT_SPACE: Readonly<Record<LookField, number>> = {
  build: 8,
  skin: SKINS.length,
  hair: 8,
  hairRamp: HAIR_RAMPS.length,
  face: FACES.length,
  palette: 6,
  accessory: ACCESSORIES.length,
  overlay: OVERLAYS.length,
};

/** Variant count per look field for interns (24x36 frames): fewer builds, hair styles and accessories. */
export const INTERN_SPACE: Readonly<Record<LookField, number>> = {
  ...AGENT_SPACE,
  build: 3,
  hair: 4,
  accessory: INTERN_ACCESSORIES.length,
};
