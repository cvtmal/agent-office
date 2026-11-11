// Heads, hair, face extras and accessories (plan steps 3.3 and 11.1). Every part
// is drawn in the slot alphabet of builds.ts (plus the few fixed colours of
// HEAD_FIXED_KEY) and positioned relative to the build's `head` anchor (the
// top-left of the 14x12 head box). DOM-free.
//
// Placement (for compose.ts): every part except HEAD carries `anchors.head`, the
// point inside the part where the head box's top-left falls, so a part is drawn
// at frame (head.x - part.anchors.head.x, head.y - part.anchors.head.y).
//   HEAD                  14x12, at the `head` anchor itself
//   hair 0 `swoop`        16x8,  anchors.head (1, 2)
//   hair 1-7, faces,      20x20, anchors.head (3, 4) = HEAD_PART_ORIGIN: the part
//   accessories           spans head x -3..16, y -4..15 (rows above the head
//                         box are clipped by the frame on builds with a high head)
//
// Layer order (compose.ts, back to front): build -> HEAD -> face -> hair -> accessory.
// Eyebrows live in the hair layer (tone `h`, head row 4, columns 3-5 and 8-10),
// so they take the hair colour and every hair style has them; glasses sit on
// rows 5-8 below them and leave the eye pixels transparent (blink still works).
//
// Colours:
//   hair 0-7     h i j (hair ramp: dark/outline, base, light) only, so the
//                look's hair ramp recolours every style and the brows
//   glasses      o (night0 frame); lenses transparent, so the eyes blink through
//   beard        h i j (hair ramp, follows the hair colour) + 1 (skin shade: mouth)
//   headphones   o (outline), B (fixed night2 band), m n (accent cups)
//   cap          o (outline), m n (accent)
//   beanie       o (outline), t u v (top material)
//   hoops        G Y (fixed gold)
// compose.ts must rasterise faces and accessories with
// `headPartKey(keyFor(tones))` so that the fixed chars resolve.
import type { Grid } from '../../render/raster.js';
import type { Anchor, SpriteDef } from '../types.js';
import { HEAD_BOX, PART_KEY } from './builds.js';
import { ACCESSORIES, FACES } from './space.js';

/**
 * The head box, 14x12: a round face with ears at rows 6-7, eyes (`e` over `E`)
 * at EYES, a nose shadow and a small mouth. Lit from the upper left: highlight
 * `3` on the forehead's left, shade `1` down the right cheek and jaw.
 */
export const HEAD: SpriteDef = {
  id: 'char-head',
  w: HEAD_BOX.w,
  h: HEAD_BOX.h,
  key: PART_KEY,
  grid: [
    '...oooooooo...', // 0
    '..o33322222o..',
    '.o3332222221o.',
    '.o3322222221o.',
    '.o3222222211o.',
    '.o2222222211o.', // 5
    'o222e2222e211o', // 6 eyes (upper), ears
    'o122E2222E211o', // 7 eyes (lower), inner ear
    '.o2222212221o.', // 8 nose shadow
    '.o2222112211o.', // 9 mouth
    '..o22222221o..',
    '...oooooooo...', // 11 chin
  ],
};

/** A part worn on the head: `anchors.head` is where the head box's top-left falls inside it. */
export interface HeadPartDef extends SpriteDef {
  anchors: { head: Anchor };
}

/** A hair style (a head part drawn in hair slots `h i j` only). */
export type HairDef = HeadPartDef;

/** Fixed colours of face extras and accessories: chars outside the slot alphabet, the same in every look. */
export const HEAD_FIXED_KEY: Readonly<Record<string, string>> = {
  B: 'night2', // headphone band
  G: 'lamp1', // gold, lit
  Y: 'lamp0', // gold, shade
};

/** A look's slot key extended with HEAD_FIXED_KEY: the key to rasterise faces and accessories with. */
export function headPartKey(slotKey: Readonly<Record<string, string>>): Record<string, string> {
  return { ...slotKey, ...HEAD_FIXED_KEY };
}

/** Where the head box's top-left falls inside the 20x20 parts (hair 1-7, faces, accessories). */
export const HEAD_PART_ORIGIN: Anchor = { x: 3, y: 4 };
const PART_SIZE = 20;

/** A 20x20 head part from its rows (each 20 wide); rows missing at the bottom are transparent. */
function part(id: string, rows: readonly string[], key: Readonly<Record<string, string>> = PART_KEY): HeadPartDef {
  const blank = '.'.repeat(PART_SIZE);
  const grid: Grid = Array.from({ length: PART_SIZE }, (_, y) => rows[y] ?? blank);
  return { id, w: PART_SIZE, h: PART_SIZE, key, grid, anchors: { head: { ...HEAD_PART_ORIGIN } } };
}

/** Two grids of the same size, `top` drawn over `bottom` ('.' lets the bottom through). */
function overlay(bottom: Grid, top: Grid): Grid {
  return bottom.map((row, y) => [...row].map((ch, x) => (top[y]?.charAt(x) ?? '.') === '.' ? ch : (top[y]?.charAt(x) ?? ch)).join(''));
}

/*
 * The head box inside a 20x20 part, for drawing the parts below
 * (x = head x + 3, y = head y + 4; brows on row 8, eyes at x 7 and 12 on rows 10-11):
 *
 *    4  '......oooooooo......'
 *    5  '.....o33322222o.....'
 *    6  '....o3332222221o....'
 *    7  '....o3322222221o....'
 *    8  '....o3222222211o....'  brow row
 *    9  '....o2222222211o....'
 *   10  '...o222e2222e211o...'  eyes, ears
 *   11  '...o122E2222E211o...'
 *   12  '....o2222212221o....'
 *   13  '....o2222112211o....'  mouth
 *   14  '.....o22222221o.....'
 *   15  '......oooooooo......'  chin
 */

/**
 * Hair style 0 `swoop`, 16x8: a full crop that wraps the skull 1 px past the head
 * box, light on the upper left (`j`), a fringe swept to the left with a gap
 * over the right brow (row 6 carries the right eyebrow), short sideburns.
 * The hair's dark tone `h` is its outline.
 */
const SWOOP: HairDef = {
  id: 'char-hair-swoop',
  w: 16,
  h: 8,
  key: PART_KEY,
  anchors: { head: { x: 1, y: 2 } },
  grid: [
    '....hhhhhhhh....',
    '..hhjjjjiiiihh..',
    '.hjjjiiiiiiiiih.',
    '.hjjiiiiiiiiiih.',
    'hjiiiiiiiiiiiiih',
    'hiiiiiiiiiiiiiih',
    'hiiiiih.hhhh.ihh',
    '.hih.........ih.',
  ],
};

/** Hair style 1 `short`: a tight crew cut 1 px above the skull, straight hairline at head row 2, temples and short sideburns. */
const SHORT = part('char-hair-short', [
  '....................',
  '....................',
  '....................',
  '......hhhhhhhh......',
  '.....hjjjiiiiih.....',
  '....hjjiiiiiiiih....',
  '....hjiihiiihiih....',
  '....hh........hh....',
  '....h.hhh..hhh.h....',
  '....h..........h....',
]);

/** Hair style 2 `bob`: a rounded helmet to the jaw, a straight fringe at head row 3, side panels over the ears. */
const BOB = part('char-hair-bob', [
  '....................',
  '....................',
  '......hhhhhhhh......',
  '....hhjjjiiiiihh....',
  '...hjjjiiiiiiiiih...',
  '...hjjiiiiiiiiiih...',
  '..hjjiiiiiiiiiiiih..',
  '..hjiihhhhhhhhiiih..',
  '..hjh.hhh..hhh.hih..',
  '..hjh..........hih..',
  '..hih..........hih..',
  '..hih..........hih..',
  '..hiih........hiih..',
  '..hiih........hiih..',
  '...hhh........hhh...',
]);

/** Hair style 3 `curly`: a big round cloud 4 px above the skull and 2 px past each side, bumpy edge, dark curls inside. */
const CURLY = part('char-hair-curly', [
  '.....hhh.hhh.hhh....',
  '...hhjjjhjjihiiihh..',
  '..hjjjjijjiiiiiiiih.',
  '.hjjhjjiiijiihiiiih.',
  '.hjjjiijiiiiiiijiiih',
  'hjjiiiiihiiiiiiiiiih',
  'hjhiiiijiiiijiihiiih',
  'hiiihh.hh.hh.hhhiiih',
  'hiih..hhh..hhh..hiih',
  'hiih............hiih',
  '.hih............hih.',
  '.hih............hih.',
  '..hh............hh..',
]);

/** Hair style 4 `bun`: hair pulled back flat with a round bun on top, tied with a dark band. */
const BUN = part('char-hair-bun', [
  '........hhhh........',
  '.......hjjiih.......',
  '.......hjiiih.......',
  '......hhhhhhhh......',
  '.....hjjjiiiiih.....',
  '....hjjiiiiiiiih....',
  '....hjiiiiiiiiih....',
  '....hih......hih....',
  '....h.hhh..hhh.h....',
  '....h..........h....',
]);

/** Hair style 5 `mohawk`: a narrow crest 4 px above the skull, shaved sides. */
const MOHAWK = part('char-hair-mohawk', [
  '.........hh.........',
  '........hjih........',
  '........hjih........',
  '........hjih........',
  '........hjih........',
  '........hjih........',
  '........hiih........',
  '.........hh.........',
  '......hhh..hhh......',
]);

/** Hair style 6 `long`: a centre parting, straight hair framing the face and falling onto the shoulders. */
const LONG = part('char-hair-long', [
  '....................',
  '....................',
  '......hhhhhhhh......',
  '....hhjjjhhiiihh....',
  '...hjjjjjhhiiiiih...',
  '..hjjjjjh..hiiiiih..',
  '..hjjjjh....hiiiih..',
  '..hjjih......hiiih..',
  '..hjh.hhh..hhh.hih..',
  '..hjh..........hih..',
  '..hjh..........hih..',
  '..hjh..........hih..',
  '..hjh..........hih..',
  '..hjih........hiih..',
  '..hjih........hiih..',
  '.hjiih........hiiih.',
  '.hjiih........hiiih.',
  '.hjiih........hiiih.',
  '.hhhh..........hhhh.',
]);

/** Hair style 7 `bald-with-fringe`: a bare scalp with bushy tufts around the ears and heavy brows. */
const BALD = part('char-hair-bald-fringe', [
  '....................',
  '....................',
  '....................',
  '....................',
  '....................',
  '....................',
  '....................',
  '...h............h...',
  '..hjh.hhh..hhh.hih..',
  '.hjih..........hiih.',
  'hjiih..........hiihh',
  '.hiih..........hiih.',
  '..hih..........hih..',
  '...h............h...',
]);

/** Every hair style, by look index (P-5): swoop, short, bob, curly, bun, mohawk, long, bald-with-fringe. */
export const HAIRS: readonly HairDef[] = [SWOOP, SHORT, BOB, CURLY, BUN, MOHAWK, LONG, BALD];

const GLASSES_ROWS: Grid = part('-', [
  '....................',
  '....................',
  '....................',
  '....................',
  '....................',
  '....................',
  '....................',
  '....................',
  '....................',
  '.....oooooooooo.....',
  '....oo..o..o..oo....',
  '.....o..o..o..o.....',
  '.....oooo..oooo.....',
]).grid;

const BEARD_ROWS: Grid = part('-', [
  '....................',
  '....................',
  '....................',
  '....................',
  '....................',
  '....................',
  '....................',
  '....................',
  '....................',
  '....................',
  '....h..........h....',
  '....hj........ih....',
  '....hjj......iih....',
  '....hjihjjjjhiih....',
  '.....hjii11iiih.....',
  '......hjiiiiih......',
  '.......hhhhhh.......',
]).grid;

const FACE_KEY = headPartKey(PART_KEY);

/** Face extras by name (the `none` face draws nothing). */
const FACE_BY_NAME: Readonly<Record<Exclude<(typeof FACES)[number], 'none'>, HeadPartDef>> = {
  glasses: part('char-face-glasses', GLASSES_ROWS, FACE_KEY),
  beard: part('char-face-beard', BEARD_ROWS, FACE_KEY),
  'glasses+beard': part('char-face-glasses-beard', overlay(BEARD_ROWS, GLASSES_ROWS), FACE_KEY),
};

/** Face extras (`glasses`, `beard`, `glasses+beard`): FACES index i >= 1 is FACE_PARTS[i - 1]. */
export const FACE_PARTS: readonly HeadPartDef[] = FACES.flatMap((f) => (f === 'none' ? [] : [FACE_BY_NAME[f]]));

/** The face extra of look index `i` (FACES), or null for `none`; throws outside the range. */
export function faceFor(i: number): HeadPartDef | null {
  const name = FACES[i];
  if (name === undefined) throw new Error(`face index out of range: ${String(i)}`);
  return name === 'none' ? null : FACE_BY_NAME[name];
}

/** Accessories by name (the `none` accessory draws nothing). */
const ACCESSORY_BY_NAME: Readonly<Record<Exclude<(typeof ACCESSORIES)[number], 'none'>, HeadPartDef>> = {
  /** Over-ear headphones: a night band over the hair, big cups in the accent colour over the ears. */
  headphones: part(
    'char-acc-headphones',
    [
      '....................',
      '....................',
      '.......oooooo.......',
      '.....ooBBBBBBoo.....',
      '....oBBoooooooBo....',
      '...oBo........oBo...',
      '...oBo........oBo...',
      '..oBo..........oBo..',
      '..oBo..........oBo..',
      'ooooo..........ooooo',
      'onnmo..........onnmo',
      'onmmo..........onmmo',
      'onmmo..........onmmo',
      'ommmo..........ommmo',
      '.ooo............ooo.',
    ],
    FACE_KEY,
  ),
  /** Baseball cap in the accent colour: a dome down to head row 3 and a brim cocked out to the left. */
  cap: part(
    'char-acc-cap',
    [
      '....................',
      '.........oo.........',
      '......oooooooo......',
      '....oonnnnnmmmoo....',
      '...onnnnnmmmmmmmo...',
      '...onnnnmmmmmmmmo...',
      '...onnnmmmmmmmmmo...',
      'oooonnnnnnnnnnnnno..',
      'ommmmmmmmmmoooooo...',
      '.ooooooooooo........',
    ],
    FACE_KEY,
  ),
  /** Beanie in the top's colour: a tall dome with a pompom and a ribbed cuff down to head row 3. */
  beanie: part(
    'char-acc-beanie',
    [
      '........oooo........',
      '.......ovvvuo.......',
      '......oovvuuoo......',
      '....oovvvvuuuuoo....',
      '...ovvvvvuuuuuuuo...',
      '...ovvvuuuuuuuuto...',
      '..ovuvuvuvuvuvutuo..',
      '..otututututututto..',
      '...oooooooooooooo...',
    ],
    FACE_KEY,
  ),
  /** Big gold hoop earrings hanging under both ears. */
  hoops: part(
    'char-acc-hoops',
    [
      '....................',
      '....................',
      '....................',
      '....................',
      '....................',
      '....................',
      '....................',
      '....................',
      '....................',
      '....................',
      '....................',
      '....................',
      '..GG............GG..',
      '.G..Y..........G..Y.',
      '.G..Y..........G..Y.',
      '..YY............YY..',
    ],
    FACE_KEY,
  ),
};

/** Agent accessories (`headphones`, `cap`, `beanie`, `hoops`): ACCESSORIES index i >= 1 is ACCESSORY_PARTS[i - 1]. */
export const ACCESSORY_PARTS: readonly HeadPartDef[] = ACCESSORIES.flatMap((a) =>
  a === 'none' ? [] : [ACCESSORY_BY_NAME[a]],
);

/** The accessory of look index `i` (ACCESSORIES), or null for `none`; throws outside the range. */
export function accessoryFor(i: number): HeadPartDef | null {
  const name = ACCESSORIES[i];
  if (name === undefined) throw new Error(`accessory index out of range: ${String(i)}`);
  return name === 'none' ? null : ACCESSORY_BY_NAME[name];
}
