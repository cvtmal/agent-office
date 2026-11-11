// Sprite family `life` (#5 plan step 5.3, research R3, R7, R12): the small
// overlays office/life draws over the room while characters work, wait, rest
// and sweat. All original, palette-indexed, at most 12x12, readable at 1x;
// outlines in the darkest tone of each ramp (never black), light from the upper
// left. No confetti sprite: confetti are single-pixel rects (PL5).
//
//   busy, per activity kind (drawn on the desk, monitor or wall, never on the
//   arms, so they read past the monitors that cover chins, R12):
//     life-papers         read      a sheet held up with a second one behind it
//     life-hands0/1       write     two hands typing (frames alternate), skinA:
//                                   recolour with rampMap('skinA', <skin>) per look
//     life-terminal       shell     a terminal window, green prompt and cursor
//     life-globe          web       a globe with green continents
//     life-folder         delegate  a manila folder with a sheet sticking out
//     life-sticky         plan      a sticky note with scribbled lines
//   life-hand             waiting   a raised open hand (skinA, recolour per look)
//   life-mug              idle      a coffee mug held in the kitchen
//   life-steam0/1         idle      two frames of steam above the mug
//   life-sweat0/1         RECYCLE / HANDOVER: a sweat drop, two frames
// DOM-free.
import type { Family, SpriteDef } from '../types.js';

/** Skin in the reference ramp (characters/builds.ts DEFAULT_TONES) with the character outline. */
const SKIN = { o: 'night0', '1': 'skinA0', '2': 'skinA1', '3': 'skinA2' } as const;

/** Paper: lavender outline, shade, sheet, text lines. */
const PAPER = { o: 'night2', '1': 'night3', '2': 'night4', '3': 'lamp2', l: 'night2' } as const;

/** Read: a sheet held up in front of a second, offset sheet; lines of text, a folded corner. */
const PAPERS: SpriteDef = {
  id: 'life-papers',
  w: 11,
  h: 10,
  key: PAPER,
  grid: [
    '...oooooooo',
    '...o222222o',
    'oooooooo22o',
    'o333333o21o',
    'o3lll33o21o',
    'o333333o21o',
    'o3llll3o11o',
    'o333333oooo',
    'o3ll3211o..',
    'oooooooo...',
  ],
};

/** Write: two typing hands seen from above, fingers down; in frame 0 the left hand strikes (1 px lower), in frame 1 the right. */
function hands(leftDown: boolean): string[] {
  const up = ['.ooo.', 'o332o', 'o221o', 'o.o.o', '.....'];
  const down = ['.....', '.ooo.', 'o332o', 'o221o', 'o.o.o'];
  const l = leftDown ? down : up;
  const r = leftDown ? up : down;
  return l.map((row, y) => `${row}..${r[y] ?? '.....'}`);
}

const HANDS0: SpriteDef = { id: 'life-hands0', w: 12, h: 5, key: SKIN, grid: hands(true) };
const HANDS1: SpriteDef = { id: 'life-hands1', w: 12, h: 5, key: SKIN, grid: hands(false) };

/** Shell: a small terminal window, title bar, dark screen, green prompt lines and a cursor block. */
const TERMINAL: SpriteDef = {
  id: 'life-terminal',
  w: 12,
  h: 9,
  key: { o: 'night0', b: 'night1', t: 'night3', T: 'night4', g: 'screen1', G: 'green1', d: 'green0' },
  grid: [
    'oooooooooooo',
    'otTtttttttto',
    'oooooooooooo',
    'obbbbbbbbbbo',
    'ogbdddGdbbbo',
    'obbbbbbbbbbo',
    'ogbddGbbbbbo',
    'ogbggbbbbbbo',
    'oooooooooooo',
  ],
};

/** Web: a globe, blue sea lit from the upper left, green continents, a lavender glint. */
const GLOBE: SpriteDef = {
  id: 'life-globe',
  w: 10,
  h: 10,
  key: { o: 'blue0', s: 'blue1', S: 'screen0', g: 'green1', G: 'green0', h: 'night4', d: 'night1' },
  grid: [
    '...oooo...',
    '.oohSSsoo.',
    '.ohggSSsso',
    'oSggggsGso',
    'oSSgGsssso',
    'osSSsssggo',
    'ossssssgGo',
    '.osgGssGo.',
    '.ooosssoo.',
    '...dooo...',
  ],
};

/** Delegate: a manila folder with its tab up and a sheet peeking out. */
const FOLDER: SpriteDef = {
  id: 'life-folder',
  w: 12,
  h: 9,
  key: { o: 'wood1', '1': 'lamp0', '2': 'lamp1', '3': 'lamp2', p: 'night4', P: 'night3' },
  grid: [
    'oooo........',
    'o22oooooooo.',
    'o2pppppppPo.',
    'oooooooooooo',
    'o3333222222o',
    'o3222222221o',
    'o2222222221o',
    'o2222222111o',
    'oooooooooooo',
  ],
};

/** Plan: a square sticky note on the wall, a tape strip, two scribbled lines, the curled corner in shade. */
const STICKY: SpriteDef = {
  id: 'life-sticky',
  w: 9,
  h: 9,
  key: { o: 'wood1', '1': 'lamp0', '2': 'lamp1', '3': 'lamp2', l: 'wood2', t: 'night4' },
  grid: [
    '...ttt...',
    'oooooooo.',
    'o332222o.',
    'o3llll2o.',
    'o222222o.',
    'o2lll22o.',
    'o222221oo',
    'o222211o.',
    'ooooooo..',
  ],
};

/** Waiting: a raised open hand, four fingers and a thumb, the wrist below (skinA; recolour per look). */
const HAND: SpriteDef = {
  id: 'life-hand',
  w: 8,
  h: 11,
  key: SKIN,
  grid: [
    '..o.o...',
    '.o3o2oo.',
    '.o3o2o2o',
    'oo3o2o2o',
    'o3o3222o',
    'o3o2222o',
    '.o32221o',
    '.o22221o',
    '..o221o.',
    '..o221o.',
    '..o221o.',
  ],
};

/** Idle: a coffee mug, cream glaze lit on the left, a handle, dark coffee at the rim. */
const MUG: SpriteDef = {
  id: 'life-mug',
  w: 7,
  h: 7,
  key: { o: 'night1', '1': 'night3', '2': 'night4', '3': 'lamp2', c: 'wood0', C: 'wood1' },
  grid: [
    'ooooo..',
    'ocCco..',
    'o3221oo',
    'o3221.o',
    'o3221oo',
    'o2211o.',
    '.ooo...',
  ],
};

/** Steam above the mug: two wisps that sway left and right between the frames. */
const STEAM_KEY = { s: 'night4', S: 'night3' } as const;
const STEAM0: SpriteDef = {
  id: 'life-steam0',
  w: 5,
  h: 6,
  key: STEAM_KEY,
  grid: ['.s...', 's..S.', '.s.S.', '..s..', '.s.S.', '.s...'],
};
const STEAM1: SpriteDef = {
  id: 'life-steam1',
  w: 5,
  h: 6,
  key: STEAM_KEY,
  grid: ['...s.', '.S..s', '.S.s.', '..s..', '.S.s.', '...s.'],
};

/** Sweat: a blue drop with a cream glint; frame 1 hangs a pixel lower and longer. */
const SWEAT_KEY = { o: 'blue0', s: 'blue1', S: 'screen0', w: 'lamp2' } as const;
const SWEAT0: SpriteDef = {
  id: 'life-sweat0',
  w: 5,
  h: 7,
  key: SWEAT_KEY,
  grid: ['..o..', '.oSo.', '.oSo.', 'oSwso', 'oSsso', '.oso.', '..o..'],
};
const SWEAT1: SpriteDef = {
  id: 'life-sweat1',
  w: 5,
  h: 7,
  key: SWEAT_KEY,
  grid: ['.....', '..o..', '.oSo.', 'oSwso', 'oSsso', 'oSsso', '.ooo.'],
};

/** Every life sprite, in the order of the header. */
export const LIFE_SPRITES: readonly SpriteDef[] = [
  PAPERS,
  HANDS0,
  HANDS1,
  TERMINAL,
  GLOBE,
  FOLDER,
  STICKY,
  HAND,
  MUG,
  STEAM0,
  STEAM1,
  SWEAT0,
  SWEAT1,
];

/** The `life` family; preview sheet `var/sprites/life.png`. */
export const lifeFamily: Family = { name: 'life', sprites: [...LIFE_SPRITES] };
