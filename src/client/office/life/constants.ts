// Constants of the office life model (#5, research R1-R10). None of these exist in
// src/shared/constants.ts; every life module imports its numbers from here. DOM-free.

/** Walk grid cell size in px (R1): the 480x270 scene is 60 x 34 cells. */
export const CELL = 8;
/** Walking speed in px per second (R4). */
export const WALK_PX_PER_S = 48;
/** Duration of one walk frame in ms (R4). */
export const WALK_FRAME_MS = 150;
/** Frames per walk cycle (R4). */
export const WALK_FRAMES = 4;
/** An idle character moves from the kitchen to the couch after this long without activity (R2). */
export const COUCH_AFTER_MS = 120_000;
/** An ended character's desk is tidied this long after its last activity (R2). */
export const TIDY_AFTER_MS = 300_000;
/** A bubble hides this long after its last content change (R6). */
export const BUBBLE_SHOW_MS = 3_000;
/** A bubble's content changes at most once per this many ms (R6). */
export const BUBBLE_MIN_CHANGE_MS = 1_000;
/** Most glyphs of a bubble's text, the `…` and the ` xN` suffix included (R6). */
export const BUBBLE_GLYPHS = 16;
/** Confetti particles per celebration (R8). */
export const CONFETTI_COUNT = 40;
/** Confetti lifetime in ms (R8). */
export const CONFETTI_MS = 2_500;
/** Confetti gravity in px per second squared (R8). */
export const CONFETTI_GRAVITY = 60;
/** How long a cheering character cheers, in ms (R8). */
export const CHEER_MS = 3_000;
/** Duration of one cheer frame in ms (R8). */
export const CHEER_FRAME_MS = 250;
/** Duration of one sweat-drop frame in ms (R7). */
export const SWEAT_FRAME_MS = 400;
/** Duration of one typing-hands frame in ms (R3). */
export const HANDS_FRAME_MS = 200;
/** Duration of one coffee-steam frame in ms (R3). */
export const STEAM_FRAME_MS = 300;
/** A delegated folder travels from the desk edge to the intern spot in this many ms, looping (R3). */
export const FOLDER_MS = 1_000;
/** `office:layout` is re-emitted at most this often while characters walk (R10). */
export const LAYOUT_EVERY_MS = 100;
/** Scene y above which the back wall is (ZONES.backWall, rows 0-4); not walkable (R1). */
export const BACK_WALL_Y = 80;

/** Character pose frame names the sprite families provide (Phase 5, `POSE_FRAMES`). */
export const WALK_FRAME_NAMES = ['walk0', 'walk1', 'walk2', 'walk3'] as const;
export const HEAD_FRAME = 'head';
export const CHEER_FRAME_NAMES = ['cheer0', 'cheer1'] as const;

/** Overlay sprite ids of the `life` sprite family (Phase 5, Step 5.3). */
export const LIFE_SPRITES = {
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
