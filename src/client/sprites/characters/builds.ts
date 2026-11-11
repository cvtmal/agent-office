// The root of the paper doll (plan step 3.3, P-5, P-6): the slot alphabet every
// character part is drawn in, the head-box contract, the foot shadow and the
// bodies ("builds"): build 0 typed out, builds 1-7 drawn by `body()` (phase 10).
//
// How a character is put together (see compose.ts):
//   shadow -> build -> head -> hair, each part a grid drawn in slot chars;
//   `keyFor(tones)` turns the slot chars into palette colours for one look, so a
//   part is drawn once and worn in every skin, cloth set and hair colour.
//
// Anchors of a build (frame pixels from the top-left of the 32x48 frame):
//   head   top-left of the 14x12 head box (heads.ts draws into it)
//   eyes   left eye (upper pixel); `eyes-r` the right eye; both = head + EYES
//   torso  top-left of the chest, where clothing overlays attach (phase 10)
//   waist  belt row: idle frame 1 (breathing) moves every row above it down 1 px
//   shadow top-left of the foot shadow
// DOM-free.
import { ellipse, grid } from '../kit.js';
import type { Anchor, SpriteDef } from '../types.js';

/** Character frame size (art direction § Rules). */
export const CHAR_W = 32;
export const CHAR_H = 48;

/** A part of the paper doll that has its own colour ramp. */
export type Part = 'outline' | 'eye' | 'shadow' | 'skin' | 'top' | 'trousers' | 'shoes' | 'accent' | 'hair';

/** Palette colour names per part, dark -> light (skin and cloth: 3 tones; outline, eye, shadow: 1). */
export type PartTones = Readonly<Record<Part, readonly string[]>>;

/**
 * The slot alphabet: grid char -> part and tone index into that part's ramp.
 * Plan names in brackets. Tones run dark -> light within a part.
 *
 *   o  outline (night0)               e  eye, upper pixel     E  eye, lower pixel
 *   1 2 3  skin shade/base/light [s1-3]
 *   t u v  top deep/shade/base [t1-3]  (light comes from the upper left: lit side `v`)
 *   x      top highlight (tone 3): lit shoulder tops; clamps to `v` while the
 *          cloth materials have 3 tones, lights up once compose.ts adds a 4th
 *   p q    trousers shade/base [p1-2]
 *   f g    shoes shade/base [h1-2]     (`h` is taken by hair)
 *   k m n  accent deep/shade/base (belt, trims, prints; jacket folds use `k`)
 *   h i j  hair dark/base/light        (`h` doubles as the hair's own outline)
 *   w      foot shadow
 *
 * Cloth parts are 3-tone materials (compose.ts); the 2-tone slots use tones 1-2.
 */
export const SLOTS: Readonly<Record<string, { part: Part; tone: number }>> = {
  o: { part: 'outline', tone: 0 },
  e: { part: 'eye', tone: 0 },
  E: { part: 'eye', tone: 0 },
  w: { part: 'shadow', tone: 0 },
  '1': { part: 'skin', tone: 0 },
  '2': { part: 'skin', tone: 1 },
  '3': { part: 'skin', tone: 2 },
  t: { part: 'top', tone: 0 },
  u: { part: 'top', tone: 1 },
  v: { part: 'top', tone: 2 },
  x: { part: 'top', tone: 3 },
  p: { part: 'trousers', tone: 1 },
  q: { part: 'trousers', tone: 2 },
  f: { part: 'shoes', tone: 1 },
  g: { part: 'shoes', tone: 2 },
  k: { part: 'accent', tone: 0 },
  m: { part: 'accent', tone: 1 },
  n: { part: 'accent', tone: 2 },
  h: { part: 'hair', tone: 0 },
  i: { part: 'hair', tone: 1 },
  j: { part: 'hair', tone: 2 },
};

/**
 * Slot char -> palette colour for one set of part tones. With `blink`, the eye
 * closes: the upper eye pixel takes the skin base, the lower one the skin shade
 * (a lid line), which is idle frame 3 (P-10).
 */
export function keyFor(tones: PartTones, opts: { blink?: boolean } = {}): Record<string, string> {
  const key = Object.fromEntries(
    Object.entries(SLOTS).map(([ch, { part, tone }]) => {
      const ramp = tones[part];
      const name = ramp[Math.min(tone, ramp.length - 1)];
      if (name === undefined) throw new Error(`no tone for part ${part}`);
      return [ch, name];
    }),
  );
  if (opts.blink === true) {
    key['e'] = tones.skin[1] ?? key['e'] ?? 'night0';
    key['E'] = tones.skin[0] ?? key['E'] ?? 'night0';
  }
  return key;
}

/** The reference look the part sprites carry as their own `key` (registry and preview sheet): fair skin, moss top, denim, cream shoes, brown hair. */
export const DEFAULT_TONES: PartTones = {
  outline: ['night0'],
  eye: ['night0'],
  shadow: ['night0'],
  skin: ['skinA0', 'skinA1', 'skinA2'],
  top: ['night1', 'green0', 'green1'],
  trousers: ['night1', 'blue0', 'blue1'],
  shoes: ['night3', 'night4', 'lamp2'],
  accent: ['wood0', 'wood1', 'wood2'],
  hair: ['wood0', 'wood1', 'wood2'],
};

/** Palette key of every part sprite: the slot alphabet in the reference look. */
export const PART_KEY: Readonly<Record<string, string>> = keyFor(DEFAULT_TONES);

/** The head box every build leaves room for and every head fills (heads.ts). */
export const HEAD_BOX = { w: 14, h: 12 } as const;

/** Eye positions inside the head box (upper pixel; each eye is 1x2: `e` over `E`). */
export const EYES: readonly [Anchor, Anchor] = [
  { x: 4, y: 6 },
  { x: 9, y: 6 },
];

/** Named anchors every build carries (see the header). A type alias, so it fits `SpriteDef.anchors`' index signature. */
export type BuildAnchors = Readonly<Record<'head' | 'eyes' | 'eyes-r' | 'torso' | 'waist' | 'shadow', Anchor>>;

/**
 * Shoulder width class of a build; picks the overlay variant (overlays.ts):
 * narrow = 18 px of cloth at the shoulders (figure 20), regular = 20 (22), wide = 24 (26).
 */
export type WidthClass = 'narrow' | 'regular' | 'wide';

/** A body: a full 32x48 frame in slot chars with its anchors. */
export interface BuildDef extends SpriteDef {
  anchors: BuildAnchors;
  /** Shoulder width class (overlays.ts picks its variant by it). */
  width: WidthClass;
}

/** Anchors of a build from its head position (eyes follow from EYES) and the other points. */
function anchors(head: Anchor, rest: Omit<BuildAnchors, 'head' | 'eyes' | 'eyes-r'>): BuildAnchors {
  const [l, r] = EYES;
  return {
    head,
    eyes: { x: head.x + l.x, y: head.y + l.y },
    'eyes-r': { x: head.x + r.x, y: head.y + r.y },
    ...rest,
  };
}

/** Foot shadow, 24x4: a dark ellipse whose outer ring is dithered away so it reads soft. */
function footShadow(): readonly string[] {
  const w = 24;
  const h = 4;
  const solid = ellipse(w, h, 'w');
  return grid(w, h, (x, y) => {
    if (solid[y]?.charAt(x) !== 'w') return '.';
    const nx = (x + 0.5 - w / 2) / (w / 2);
    const ny = (y + 0.5 - h / 2) / (h / 2);
    const rim = nx * nx + ny * ny > 0.7;
    return rim && (x + y) % 2 === 1 ? '.' : 'w';
  });
}

/** The foot shadow every build stands on, drawn first at the build's `shadow` anchor. */
export const SHADOW: SpriteDef = { id: 'char-shadow', w: 24, h: 4, grid: footShadow(), key: PART_KEY };

/*
 * Build 0 `stocky`: figure 22 x 44 with the hair (x 5..26, y 2..45), broad
 * shoulders, long torso, long sleeves, belt at y 31, short sturdy legs, chunky
 * sneakers. Light from the upper left: the top is mostly the base tone `v`, its
 * right edge the shade `u`, the armpit folds and cuffs the deep tone `t`. Rows 0-15 are empty: the head box sits at (9, 4).
 */
const STOCKY: readonly string[] = [
  '................................', // 0
  '................................',
  '................................',
  '................................',
  '................................',
  '................................', // 5
  '................................',
  '................................',
  '................................',
  '................................',
  '................................', // 10
  '................................',
  '................................',
  '................................',
  '................................',
  '................................', // 15
  '.......ooovvvv1111uuuuooo.......', // 16 neck in shadow, collar
  '......ovvvvvvvv11vvvvvuuuo......', // 17 shoulders, v-neck
  '.....ovvvvvvvvvvvvvvvvvuuuo.....',
  '.....ovvvvvvvvvvvvvvvvvuuuo.....',
  '.....ovvutvvvvvvvvvuuutuuto.....', // 20 sleeves part from the chest
  '.....ovvutvvvvvvvvvuuutuuto.....',
  '.....ovvutvvvvvvvvvuuutuuto.....',
  '.....ovvutvvvvvvvvvuuutuuto.....',
  '.....ovvutvvvvvvvvvuuutuuto.....',
  '.....ovvutvvvvvvvvvuuutuuto.....', // 25
  '.....ovvutvvvvvvvvvuuutuuto.....',
  '.....ovvutvvvvvvvvvuuutuuto.....',
  '.....ovvutvvvvvvvvvuuutuuto.....',
  '.....ouuttvvvvvvvvvuuuttuto.....', // 29 cuffs
  '.....o322ovvvvvvvvvuuuo221o.....', // 30 hands
  '.....o221onnnnnnnnnmmmo211o.....', // 31 belt = waist
  '......ooooqqqqqqqqqpppoooo......', // 32 hips
  '.........oqqqqqqqqqpppo.........',
  '.........oqqqqqoqqqqppo.........', // 34 crotch
  '.........oqqqqpooqqqppo.........',
  '.........oqqqqpooqqqppo.........',
  '.........oqqqqpooqqqppo.........',
  '.........oqqqqpooqqqppo.........',
  '.........oqqqqpooqqqppo.........',
  '.........oqqqqpooqqqppo.........',
  '.........ogggggoogggggo.........', // 41 shoe tops
  '........oggggggooggggffo........',
  '.......ogggggggoogggggffo.......',
  '.......offffffffoffffffffo......', // 44 soles
  '........oooooooo..oooooooo......', // 45
  '................................',
  '................................',
];

/**
 * Builds 1-7 are drawn by `body()` from a few measures, in the same slot
 * alphabet, anchors and shading as build 0: fill the cloth and skin spans,
 * then ring everything with the outline `o` (4-neighbour), so gaps of 1-2 px
 * between arm and chest, hand and belt, or the legs read as outline.
 *
 * Rows, top to bottom (T = head + 12, the collar row; everything stands on y 44):
 *   T .. T+slope-1      shoulders rising to full width (neck skin in the middle)
 *   T+slope .. waist-1  chest between the arms (core, tapering or bellied)
 *   waist               belt (the hands end here, or `reach` rows lower)
 *   waist+1             hips
 *   legs rows           two legs, the crotch closing over the first two rows
 *   shoe rows           sneakers, toes turned out, sole row `f` at y 44
 */
interface BodySpec {
  name: string;
  /** Head box y (x is 9 for every build); the figure is 48 - head px tall with hair style 0. */
  head: number;
  /** Cloth width at the shoulders, arms included (even; the figure adds 2 for the outline). */
  shoulders: number;
  /** Rows the shoulders take to reach full width: 1 square, 2 normal, 3 sloping. */
  slope: 1 | 2 | 3;
  /** Width of one sleeve. */
  arm: number;
  /** Chest width between the arms at the top and at the bottom of the torso (even). */
  core: readonly [number, number];
  /** Extra chest width at the belly's widest row, about 60% down the torso (even). */
  belly?: number;
  /** Belt width, width at the top of the legs (even) and of one leg; `hipRow` (even) eases the belt into the legs (default `hips`). */
  belt: number;
  hips: number;
  hipRow?: number;
  leg: number;
  /** Leg rows between the hip row and the shoes. */
  legs: number;
  /** Px each leg narrows on its outer side from hip to ankle (tapered trousers). */
  taper?: number;
  /** Shoe rows including the sole. */
  shoe: 3 | 4;
  /** Rows the hands hang below the belt (long arms). */
  reach?: number;
}

/** Shoulder rows above the arms: width relative to `shoulders`, by `slope`. */
const SLOPES: Readonly<Record<1 | 2 | 3, readonly number[]>> = { 1: [-6], 2: [-8, -2], 3: [-8, -4, -2] };

/** Left and right x of a span `w` px wide, centred on the frame's middle (x 15.5). */
function span(w: number): readonly [number, number] {
  return [CHAR_W / 2 - w / 2, CHAR_W / 2 - 1 + w / 2];
}

/** Grid rows, anchors and width class of a build drawn from its measures (see BodySpec). */
function body(s: BodySpec): { grid: string[]; anchors: BuildAnchors; width: WidthClass } {
  const g: string[][] = Array.from({ length: CHAR_H }, () => Array.from({ length: CHAR_W }, () => '.'));
  const set = (x: number, y: number, c: string): void => {
    const row = g[y];
    if (row !== undefined && x >= 0 && x < CHAR_W) row[x] = c;
  };
  /** Cloth span lit from the upper left: base tone, the right 3 px in shade, optional lit first 2 px. */
  const cloth = (l: number, r: number, y: number, base: string, shade: string, lit?: string): void => {
    for (let x = l; x <= r; x++) set(x, y, x > r - 3 ? shade : lit !== undefined && x < l + 2 ? lit : base);
  };

  const T = s.head + HEAD_BOX.h;
  const shoeTop = 45 - s.shoe;
  const legTop = shoeTop - s.legs;
  const hip = legTop - 1;
  const waist = hip - 1;
  const reach = s.reach ?? 0;
  const hand = waist - 1 + reach; // upper hand row; the lower one is hand + 1
  const slope = SLOPES[s.slope];
  const armTop = T + slope.length;

  // Shoulders: rising rows, neck skin in a crew neck and a small V below it.
  slope.forEach((d, i) => {
    const [l, r] = span(Math.max(s.shoulders + d, 10));
    cloth(l, r, T + i, 'v', 'u', 'x');
  });
  for (let x = 14; x <= 17; x++) set(x, T, '1');
  set(15, T + 1, '1');
  set(16, T + 1, '1');

  // Chest and arms.
  const [sl, sr] = span(s.shoulders);
  const coreRows = waist - armTop;
  const coreAt = (y: number): readonly [number, number] => {
    const i = Math.min(y - armTop, coreRows - 1);
    const t = coreRows > 1 ? i / (coreRows - 1) : 0;
    const lean = Math.round(((s.core[1] - s.core[0]) / 2) * t) * 2;
    const bulge = Math.round(((s.belly ?? 0) / 2) * Math.sin(Math.PI * Math.min(1, ((i + 0.5) / coreRows) ** 1.3)));
    return span(s.core[0] + lean + bulge * 2);
  };
  for (let y = armTop; y <= hand + 1; y++) {
    const [cl, cr] = coreAt(y);
    const al = Math.min(sl, cl - s.arm); // the belly pushes the arms out
    const ar = Math.max(sr, cr + s.arm);
    const touchL = cl === al + s.arm;
    const touchR = cr === ar - s.arm;
    if (y < armTop + 2) {
      cloth(al, ar, y, 'v', 'u', y === armTop ? 'x' : undefined); // shoulders still one mass
      continue;
    }
    if (y < waist) {
      const onHands = y >= hand;
      cloth(touchL && onHands ? cl + 1 : cl, touchR && onHands ? cr - 1 : cr, y, 'v', 'u');
      if (touchL && !onHands) set(cl, y, 't'); // armpit folds
      if (touchR && !onHands) set(cr, y, 't');
    }
    for (let k = 0; k < s.arm; k++) {
      const xl = al + k;
      const xr = ar - s.arm + 1 + k;
      const last = k === s.arm - 1;
      if (y < hand - 1) {
        set(xl, y, last ? 'u' : 'v');
        set(xr, y, last ? 't' : 'u');
      } else if (y === hand - 1) {
        set(xl, y, last ? 't' : 'u'); // cuffs
        set(xr, y, k === 0 || last ? 't' : 'u');
      } else if (y === hand) {
        set(xl, y, k === 0 ? '3' : '2');
        set(xr, y, last ? '1' : '2');
      } else {
        set(xl, y, last ? '1' : '2');
        set(xr, y, k === 0 ? '2' : '1');
      }
    }
  }

  // Belt (kept 1 px off the hands, which leaves room for the outline), hips.
  let [bl, br] = span(s.belt);
  if (reach === 0) {
    const [cl] = coreAt(waist - 1);
    bl = Math.max(bl, Math.min(sl, cl - s.arm) + s.arm + 1);
    br = CHAR_W - 1 - bl;
  }
  cloth(bl, br, waist, 'n', 'm');
  const [hl, hr] = span(s.hips);
  const [pl, pr] = span(s.hipRow ?? s.hips);
  cloth(pl, pr, hip, 'q', 'p');

  // Legs: the crotch is closed on the first row, a seam on the second, then a gap.
  const taper = s.taper ?? 0;
  let legL: readonly [number, number] = [hl, hl + s.leg - 1];
  let legR: readonly [number, number] = [hr - s.leg + 1, hr];
  for (let k = 0; k < s.legs; k++) {
    const y = legTop + k;
    const tk = s.legs > 1 ? Math.round((taper * k) / (s.legs - 1)) : 0;
    legL = [hl + tk, hl + s.leg - 1];
    legR = [hr - s.leg + 1, hr - tk];
    if (k === 0) {
      cloth(legL[0], legR[1], y, 'q', 'p');
      continue;
    }
    for (let x = legL[0]; x <= legL[1]; x++) set(x, y, x === legL[1] ? 'p' : 'q');
    for (let x = legR[0]; x <= legR[1]; x++) set(x, y, x > legR[1] - 2 ? 'p' : 'q');
    if (k === 1) for (let x = legL[1] + 1; x < legR[0] - 1; x++) set(x, y, 'p');
  }

  // Shoes: toes turned out, 1 px more per row (2 at most), sole row `f`.
  for (let k = 0; k < s.shoe; k++) {
    const y = shoeTop + k;
    const ext = Math.min(k, 2);
    const sole = k === s.shoe - 1;
    for (let x = legL[0] - ext; x <= legL[1]; x++) set(x, y, sole ? 'f' : 'g');
    for (let x = legR[0]; x <= legR[1] + ext; x++) set(x, y, sole || (k > 0 && x > legR[1] + ext - 2) ? 'f' : 'g');
  }

  // Outline: every empty px with a filled 4-neighbour.
  const filled = (x: number, y: number): boolean => {
    const c = g[y]?.[x];
    return c !== undefined && c !== '.' && c !== 'o';
  };
  for (let y = 0; y < CHAR_H; y++) {
    for (let x = 0; x < CHAR_W; x++) {
      if (g[y]?.[x] !== '.') continue;
      if (filled(x - 1, y) || filled(x + 1, y) || filled(x, y - 1) || filled(x, y + 1)) set(x, y, 'o');
    }
  }

  const [coreL] = span(s.core[0]);
  return {
    grid: g.map((row) => row.join('')),
    anchors: anchors(
      { x: 9, y: s.head },
      { torso: { x: coreL + 1, y: T + 1 }, waist: { x: CHAR_W / 2, y: waist }, shadow: { x: 4, y: CHAR_H - SHADOW.h } },
    ),
    width: s.shoulders >= 24 ? 'wide' : s.shoulders >= 20 ? 'regular' : 'narrow',
  };
}

/*
 * Builds 1-7. Height (with hair style 0) = 48 - head; width = widest cloth + 2.
 *   tall   45 x 22  long legs (11 rows)
 *   round  42 x 26  sloping shoulders, belly 4 px past the shoulders, short legs, wide trousers
 *   slim   43 x 20  thin sleeves and legs, narrow hips
 *   broad  45 x 26  wide square shoulders, 4-px arms, V-taper to a 12-px belt
 *   short  40 x 20  short torso and legs (6 rows)
 *   curvy  44 x 20  narrow shoulders and waist, hips flaring to 18 px, tapered trousers
 *   lanky  45 x 20  short torso, 13-row legs, droopy shoulders, hands below the belt
 */
const SPECS: readonly BodySpec[] = [
  { name: 'tall', head: 3, shoulders: 20, slope: 2, arm: 3, core: [14, 14], belt: 12, hips: 12, leg: 5, legs: 11, shoe: 4 },
  { name: 'round', head: 6, shoulders: 20, slope: 3, arm: 3, core: [14, 14], belly: 4, belt: 16, hips: 16, leg: 7, legs: 6, shoe: 3 },
  { name: 'slim', head: 5, shoulders: 18, slope: 2, arm: 2, core: [14, 12], belt: 12, hips: 10, leg: 4, legs: 9, shoe: 3 },
  { name: 'broad', head: 3, shoulders: 24, slope: 1, arm: 4, core: [16, 12], belt: 12, hips: 12, leg: 5, legs: 9, shoe: 4 },
  { name: 'short', head: 8, shoulders: 18, slope: 2, arm: 3, core: [12, 12], belt: 12, hips: 12, leg: 5, legs: 6, shoe: 3 },
  { name: 'curvy', head: 4, shoulders: 18, slope: 2, arm: 3, core: [12, 10], belt: 10, hipRow: 14, hips: 18, leg: 8, legs: 8, taper: 3, shoe: 3 },
  { name: 'lanky', head: 3, shoulders: 18, slope: 3, arm: 2, core: [14, 10], belt: 10, hips: 10, leg: 4, legs: 13, shoe: 3, reach: 3 },
];

/** Every build, by look index (P-5: 8): stocky, tall, round, slim, broad, short, curvy, lanky. */
export const BUILDS: readonly BuildDef[] = [
  {
    id: 'char-build-stocky',
    w: CHAR_W,
    h: CHAR_H,
    grid: STOCKY,
    key: PART_KEY,
    anchors: anchors({ x: 9, y: 4 }, { torso: { x: 10, y: 17 }, waist: { x: 16, y: 31 }, shadow: { x: 4, y: 44 } }),
    width: 'regular',
  },
  ...SPECS.map((s): BuildDef => ({ id: `char-build-${s.name}`, w: CHAR_W, h: CHAR_H, key: PART_KEY, ...body(s) })),
];
