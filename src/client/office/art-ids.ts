// The art seam (docs/design/art-seam.md): every sprite id and palette name that office
// logic asks the art for by name. An art set must provide all of them; art-ids.test.ts
// checks them against the sprite registry, POSE_FRAMES and the palette. Imports nothing.

/** Character pose frame names the sprite families provide (`POSE_FRAMES`, poses.ts). */
export const WALK_FRAME_NAMES = ['walk0', 'walk1', 'walk2', 'walk3'] as const;
export const HEAD_FRAME = 'head';
export const CHEER_FRAME_NAMES = ['cheer0', 'cheer1'] as const;

/** Overlay sprite ids of the `life` sprite family (sprites/life). */
export const LIFE_IDS = {
  papers: 'life-papers',
  hands: ['life-hands0', 'life-hands1'],
  terminal: 'life-terminal',
  globe: 'life-globe',
  folder: 'life-folder',
  sticky: 'life-sticky',
  hand: 'life-hand',
  mug: 'life-mug',
  steam: ['life-steam0', 'life-steam1'],
  sweat: ['life-sweat0', 'life-sweat1'],
} as const;

/** Palette names (render/palette.ts) that office code draws in directly. */
export const ART_COLOURS = {
  /** Confetti particles, cycled in this order. */
  confetti: ['magenta1', 'orange1', 'lamp1', 'green1', 'blue1', 'neon1'],
  /** Ink of the wall texts: dark marker on the whiteboard. */
  wallInk: 'night1',
  /** Paper of the wall texts: certificate cream. */
  wallPaper: 'lamp2',
  /** Track behind the context meter's fill. */
  meterTrack: 'night3',
} as const;
