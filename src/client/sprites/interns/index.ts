// Sprite family `interns` (plan Phase 12, P-3, P-5): the smaller paper doll of
// subagents, 24x36 frames, and `composeIntern(look, frame)`, the intern twin of
// `composeCharacter` (characters/compose.ts). Parts are drawn in the slot
// alphabet of characters/builds.ts (`SLOTS`) and dressed per look with the same
// `tonesFor` / `keyFor`, so an intern wears the same skins, cloth sets and hair
// colours as the agents. One extra char: `b` = the cream intern badge.
//
// Frame and anchors (for Phase 13, which replaces `internStandIn` in office/mount.ts):
//   frame        24x36 (INTERN_W x INTERN_H); the feet anchor of a spot is the
//                frame's bottom centre (12, 36), exactly as (16, 48) for the
//                32x48 agent frame: draw at (spot.x - 12, spot.y - 36 [+ SEAT_DROP_INTERN]).
//   feet         every build's soles sit on row 32, the sole outline on row 33
//                (= INTERN_H - 3, like row 45 = CHAR_H - 3 of the agents).
//   shadow       INTERN_SHADOW 20x4 at the build's `shadow` anchor (2, 32): rows
//                32-35, centred on x 12, 2 rows below the feet (agents: same).
//   head         top-left of the 10x9 head box; x 7 on every build (head centre
//                on the frame centre), y 3 (sprout, slim) or 4 (round). Hair
//                rises at most 3 rows above it, so nothing is clipped.
//   eyes/eyes-r  head + INTERN_EYES (upper eye pixel; eyes are `e` over `E`).
//   torso        top-left of the chest (where the lanyard badge hangs).
//   waist        belt row: idle frame 1 moves every row above it down 1 px.
//
// Look fields (INTERN_SPACE): build 3, hair 4, accessory 3 (none, cap,
// headphones) are drawn here; skin, hairRamp and palette colour the parts via
// `tonesFor`. `face`: glasses for 1 (glasses) and 3 (glasses+beard), no beard
// on interns (2 = none). `overlay` is ignored: every intern wears the lanyard
// and badge instead, which tells interns from agents at a glance.
// DOM-free.
import { compose, rasterize, shiftRows, type Layer, type Raster } from '../../render/raster.js';
import { ellipse, grid } from '../kit.js';
import type { Anchor, Family, SpriteDef } from '../types.js';
import { PART_KEY, keyFor, type BuildAnchors, type PartTones } from '../characters/builds.js';
import { posed, tonesFor, type CharacterFrame, type CharacterLook, type HeadDown } from '../characters/compose.js';
import { INTERN_ACCESSORIES, INTERN_SPACE } from '../characters/space.js';

/** Intern frame size (plan P-3; equals office/layout.ts INTERN_W x INTERN_H). */
export const INTERN_W = 24;
export const INTERN_H = 36;

/** The intern head box every intern build leaves room for and INTERN_HEAD fills. */
export const INTERN_HEAD_BOX = { w: 10, h: 9 } as const;

/** Eye positions inside the intern head box (upper pixel; each eye is 1x2). */
export const INTERN_EYES: readonly [Anchor, Anchor] = [
  { x: 3, y: 4 },
  { x: 6, y: 4 },
];

/** Palette key of every intern part: the slot alphabet in the reference look, plus `b` the badge. */
export const INTERN_KEY: Readonly<Record<string, string>> = { ...PART_KEY, b: 'lamp2' };

/** The extra chars interns add to a look's key. */
const EXTRA_KEY = { b: 'lamp2' } as const;

/** An intern body: a full 24x36 frame in slot chars with the same anchors as an agent build. */
export interface InternBuildDef extends SpriteDef {
  anchors: BuildAnchors;
}

/** A part drawn over the head; `anchors.head` is where the head box's top-left falls inside it. */
export interface HeadPartDef extends SpriteDef {
  anchors: { head: Anchor };
}

/** Anchors of an intern build from its head position and the other points. */
function anchors(head: Anchor, rest: Omit<BuildAnchors, 'head' | 'eyes' | 'eyes-r'>): BuildAnchors {
  const [l, r] = INTERN_EYES;
  return {
    head,
    eyes: { x: head.x + l.x, y: head.y + l.y },
    'eyes-r': { x: head.x + r.x, y: head.y + r.y },
    ...rest,
  };
}

/** Foot shadow, 20x4: a dark ellipse with a dithered rim (the agents' shadow, scaled down). */
function footShadow(w: number, h: number): readonly string[] {
  const solid = ellipse(w, h, 'w');
  return grid(w, h, (x, y) => {
    if (solid[y]?.charAt(x) !== 'w') return '.';
    const nx = (x + 0.5 - w / 2) / (w / 2);
    const ny = (y + 0.5 - h / 2) / (h / 2);
    return nx * nx + ny * ny > 0.7 && (x + y) % 2 === 1 ? '.' : 'w';
  });
}

/** The foot shadow every intern stands on, drawn first at the build's `shadow` anchor. */
export const INTERN_SHADOW: SpriteDef = { id: 'intern-shadow', w: 20, h: 4, grid: footShadow(20, 4), key: INTERN_KEY };

/** Rows 0..n-1 of a build: empty (the head and hair are separate layers). */
function empty(n: number): string[] {
  return Array.from({ length: n }, () => '.'.repeat(INTERN_W));
}

/*
 * Build 0 `sprout`: figure 18 wide (x 3..20), a short hoodie-ish top with a
 * lanyard (`m`) and badge (`b`), belt at y 22, short legs, chunky sneakers.
 */
const SPROUT: readonly string[] = [
  ...empty(12),
  '.......ovvv11uuuo.......', // 12 neck
  '....ovvvvvm11mvvvuuo....', // 13 shoulders, lanyard
  '...ovvvvvvmvvmvvvuuuo...',
  '...ovvtvvvvmmvvvutuuo...', // 15 arms part from the chest
  '...ovvtvvvvbbvvvutuuo...', // 16 badge
  '...ovvtvvvvbbvvvutuuo...',
  '...ovvtvvvvvvvvvutuuo...',
  '...ovvtvvvvvvvvvutuuo...',
  '...outtvvvvvvvvvuttuo...', // 20 cuffs
  '...o32ovvvvvvvvvuo21o...', // 21 hands
  '...o21onnnnnnnnmmo11o...', // 22 belt = waist
  '....oooqqqqqqqqppooo....', // 23 hips
  '......oqqqqqqqqppo......',
  '......oqqqpooqqppo......', // 25 legs
  '......oqqqpooqqppo......',
  '......oqqqpooqqppo......',
  '......oqqqpooqqppo......',
  '......oqqqpooqqppo......',
  '......ogggggoggggo......', // 30 shoe tops
  '.....ogggggooggggfo.....',
  '....offffffooffffffo....', // 32 soles
  '.....oooooo..oooooo.....', // 33
  ...empty(2),
];

/*
 * Build 1 `slim`: narrow (x 4..19 with the hands), 1-px sleeves, belt one row
 * higher (y 21) and longer legs.
 */
const SLIM: readonly string[] = [
  ...empty(12),
  '.........ov11uo.........', // 12 neck
  '.......ovvm11muuo.......', // 13 narrow shoulders, lanyard
  '.....ovvvvmvvmvvuuo.....',
  '.....ovtvvvmmvvutuo.....', // 15
  '.....ovtvvvbbvvutuo.....', // 16 badge
  '.....ovtvvvbbvvutuo.....',
  '.....ovtvvvvvvvutuo.....',
  '.....ottvvvvvvvutto.....', // 19 cuffs
  '....o32ovvvvvvvuo21o....', // 20 hands
  '....o21onnnnnnmmo11o....', // 21 belt = waist
  '.....oooqqqqqqppooo.....', // 22 hips
  '.......oqqqqqqppo.......',
  '.......oqqpooqppo.......', // 24 legs
  '.......oqqpooqppo.......',
  '.......oqqpooqppo.......',
  '.......oqqpooqppo.......',
  '.......oqqpooqppo.......',
  '.......oqqpooqppo.......',
  '.......ogggooggfo.......', // 30 shoe tops
  '......oggggoogggfo......',
  '.....offffffoofffffo....', // 32 soles
  '......ooooo..ooooo......', // 33
  ...empty(2),
];

/*
 * Build 2 `round`: wide (x 2..21), head one row lower, a round belly, short
 * stubby legs, wide sneakers.
 */
const ROUND: readonly string[] = [
  ...empty(13),
  '.......ovvv11uuuo.......', // 13 neck
  '...oovvvvvm11mvvvuuoo...', // 14 shoulders, lanyard
  '..ovvvvvvvmvvmvvvvuuuo..',
  '..ovvtvvvvvmmvvvvutuuo..', // 16
  '..ovvtvvvvvbbvvvvutuuo..', // 17 badge
  '..ovvtvvvvvbbvvvvutuuo..',
  '..ovvtvvvvvvvvvvvutuuo..',
  '..outtvvvvvvvvvvuuttuo..', // 20 cuffs
  '..o32ovvvvvvvvvvuuo21o..', // 21 hands
  '..o21onnnnnnnnnnmmo11o..', // 22 belt = waist
  '...oooqqqqqqqqqpppooo...', // 23 hips
  '.....oqqqqqqqqqpppo.....',
  '.....oqqqqpooqqqppo.....', // 25 legs
  '.....oqqqqpooqqqppo.....',
  '.....oqqqqpooqqqppo.....',
  '.....oqqqqpooqqqppo.....',
  '.....oqqqqpooqqqppo.....',
  '.....ogggggoogggggo.....', // 30 shoe tops
  '....oggggggoogggggfo....',
  '...offffffffoofffffffo..', // 32 soles
  '....ooooooo..ooooooo....', // 33
  ...empty(2),
];

/** Every intern build, by look index (INTERN_SPACE.build = 3). */
export const INTERN_BUILDS: readonly InternBuildDef[] = [
  {
    id: 'intern-build-sprout',
    w: INTERN_W,
    h: INTERN_H,
    grid: SPROUT,
    key: INTERN_KEY,
    anchors: anchors({ x: 7, y: 3 }, { torso: { x: 7, y: 13 }, waist: { x: 12, y: 22 }, shadow: { x: 2, y: 32 } }),
  },
  {
    id: 'intern-build-slim',
    w: INTERN_W,
    h: INTERN_H,
    grid: SLIM,
    key: INTERN_KEY,
    anchors: anchors({ x: 7, y: 3 }, { torso: { x: 8, y: 13 }, waist: { x: 12, y: 21 }, shadow: { x: 2, y: 32 } }),
  },
  {
    id: 'intern-build-round',
    w: INTERN_W,
    h: INTERN_H,
    grid: ROUND,
    key: INTERN_KEY,
    anchors: anchors({ x: 7, y: 4 }, { torso: { x: 6, y: 14 }, waist: { x: 12, y: 22 }, shadow: { x: 2, y: 32 } }),
  },
];

/**
 * The intern head box, 10x9: rounder and softer than the agent head, eyes set
 * low (a big forehead reads young), lit from the upper left.
 */
export const INTERN_HEAD: SpriteDef = {
  id: 'intern-head',
  w: INTERN_HEAD_BOX.w,
  h: INTERN_HEAD_BOX.h,
  key: INTERN_KEY,
  grid: [
    '..oooooo..', // 0
    '.o333222o.',
    'o33222221o',
    'o32222211o',
    'o22e22e21o', // 4 eyes (upper)
    'o22E22E21o', // 5 eyes (lower)
    'o22221221o', // 6 nose shadow
    '.o221121o.', // 7 mouth
    '..oooooo..', // 8 chin
  ],
};

/** Hair 0 `tuft`: a short messy crop with a cowlick, a ragged fringe, sideburns. */
const TUFT: HeadPartDef = {
  id: 'intern-hair-tuft',
  w: 12,
  h: 8,
  key: INTERN_KEY,
  anchors: { head: { x: 1, y: 3 } },
  grid: [
    '.......hh...',
    '...hhhhhjh..',
    '..hjjjiiiih.',
    '.hjjiiiiiiih', // head row 0
    'hjjiiiiiiiih',
    'hiiiiiiiiiih',
    'hiih.iih.iih', // head row 3: ragged fringe
    '.hh......hh.', // head row 4: sideburns
  ],
};

/** Hair 1 `mop`: a heavy bowl cut, a straight fringe to the brows, long sides over the ears. */
const MOP: HeadPartDef = {
  id: 'intern-hair-mop',
  w: 12,
  h: 9,
  key: INTERN_KEY,
  anchors: { head: { x: 1, y: 2 } },
  grid: [
    '...hhhhhh...',
    '..hjjjiiih..',
    '.hjjiiiiiiih', // head row 0
    'hjjiiiiiiiih',
    'hjiiiiiiiiih',
    'hiihhhhhhiih', // head row 3: fringe edge
    'hii......iih',
    'hih......hih',
    '.h........h.', // head row 6
  ],
};

/** Hair 2 `bunches`: centre parting, two puffs sticking out at the sides with accent hair ties. */
const BUNCHES: HeadPartDef = {
  id: 'intern-hair-bunches',
  w: 16,
  h: 9,
  key: INTERN_KEY,
  anchors: { head: { x: 3, y: 2 } },
  grid: [
    '.....hhhhhh.....',
    '....hjjjiiih....',
    '...hjjiihiiih...', // head row 0, parting
    '.hhnjiiihiiinhh.', // hair ties
    'hjjhiiiiiiiihiih',
    'hjihhiihhiihhiih', // head row 3: two locks
    'hiih........hiih',
    'hiih........hiih',
    '.hh..........hh.', // head row 6
  ],
};

/** Hair 3 `spikes`: three tall spikes on top, a spiky fringe. */
const SPIKES: HeadPartDef = {
  id: 'intern-hair-spikes',
  w: 12,
  h: 8,
  key: INTERN_KEY,
  anchors: { head: { x: 1, y: 3 } },
  grid: [
    '..h...h...h.',
    '.hjh.hjh.hjh',
    '.hjjhjjihjih',
    'hjjiiiiiiiih', // head row 0
    'hjiiiiiiiiih',
    'hiiiiiiiiiih',
    'hih.hih.hiih', // head row 3: spiky fringe
    '.h........h.',
  ],
};

/** Every intern hair style, by look index (INTERN_SPACE.hair = 4). */
export const INTERN_HAIRS: readonly HeadPartDef[] = [TUFT, MOP, BUNCHES, SPIKES];

/** First head row the cap does not cover: hair above it (inside the cap's columns) is hidden. */
const CAP_BOTTOM = 3;

/** Accessory `cap`: a round crown in the accent cloth pulled low, a bill 2 px wider on each side, its shadow on the forehead. */
const CAP: HeadPartDef = {
  id: 'intern-acc-cap',
  w: 14,
  h: 7,
  key: INTERN_KEY,
  anchors: { head: { x: 2, y: 3 } },
  grid: [
    '.....oooo.....',
    '...oonnnmoo...',
    '..onnnnnnnmo..',
    '..onnnnnnmmo..', // head row 0
    '..onnnnnnmmo..',
    'ommmmmmmmmmmmo', // head row 2: bill
    '.oooooooooooo.', // head row 3: bill shadow
  ],
};

/** Accessory `headphones`: a band over the hair and big cups over the ears. */
const HEADPHONES: HeadPartDef = {
  id: 'intern-acc-headphones',
  w: 14,
  h: 10,
  key: INTERN_KEY,
  anchors: { head: { x: 2, y: 3 } },
  grid: [
    '....oooooo....',
    '..oonnnnnnoo..',
    '.ono......ono.',
    '.on........no.', // head row 0
    '.on........no.',
    'ooo........ooo',
    'onm........nmo', // head row 3
    'onm........nmo',
    'onm........nmo',
    'ooo........ooo', // head row 6
  ],
};

/** Intern accessories by INTERN_ACCESSORIES index (`none` has no part). */
const ACCESSORY_BY_NAME: Readonly<Record<(typeof INTERN_ACCESSORIES)[number], HeadPartDef | null>> = {
  none: null,
  cap: CAP,
  headphones: HEADPHONES,
};

/** Intern accessory parts (the preview sheet and registry). */
export const INTERN_ACCESSORY_PARTS: readonly HeadPartDef[] = [CAP, HEADPHONES];

/** Face extra `glasses`: two frames in the accent colour around the eyes (dark frames read as shades at this size), open below, dark temples (head rows 3-5). */
const GLASSES: HeadPartDef = {
  id: 'intern-face-glasses',
  w: 10,
  h: 6,
  key: INTERN_KEY,
  anchors: { head: { x: 0, y: 0 } },
  grid: ['..........', '..........', '..........', '..mmmmmm..', 'oom.mm.moo', '..m.mm.m..'],
};

/** Look `face` index -> intern face part: glasses for `glasses` and `glasses+beard`; interns grow no beard. */
const FACE_BY_INDEX: readonly (HeadPartDef | null)[] = [null, GLASSES, null, GLASSES];

/** The `interns` family; preview sheet `var/sprites/interns.png`. */
export const internsFamily: Family = {
  name: 'interns',
  sprites: [...INTERN_BUILDS, INTERN_SHADOW, INTERN_HEAD, ...INTERN_HAIRS, GLASSES, ...INTERN_ACCESSORY_PARTS],
};

/** Item `i` of a list, wrapping (like compose.ts: out-of-range look indices still compose). */
function at<T>(list: readonly T[], i: number): T {
  const item = list[((i % list.length) + list.length) % list.length];
  if (item === undefined) throw new Error('empty part list');
  return item;
}

/** One part rasterised with a key, placed at (dx, dy). */
function layer(def: SpriteDef, key: Readonly<Record<string, string>>, dx: number, dy: number): Layer {
  return { raster: rasterize(def.grid, key, undefined, def.id), dx, dy };
}

/** A head part placed so its `anchors.head` falls on the frame position `head`. */
function onHead(def: HeadPartDef, key: Readonly<Record<string, string>>, head: Anchor): Layer {
  return layer(def, key, head.x - def.anchors.head.x, head.y - def.anchors.head.y);
}

/** Clears hair pixels above head row CAP_BOTTOM over the head box (+1 px each side), so spikes and tufts do not poke through it. */
function underCap(hair: Layer, head: Anchor): Layer {
  const r = hair.raster;
  const out: Raster = { w: r.w, h: r.h, data: new Uint8ClampedArray(r.data) };
  const left = head.x - 1;
  const right = head.x + INTERN_HEAD_BOX.w + 1;
  for (let y = 0; y < r.h; y++) {
    if (hair.dy + y >= head.y + CAP_BOTTOM) break;
    for (let x = 0; x < r.w; x++) {
      const fx = hair.dx + x;
      if (fx >= left && fx < right) out.data.fill(0, (y * r.w + x) * 4, (y * r.w + x) * 4 + 4);
    }
  }
  return { ...hair, raster: out };
}

/** The key of one intern look: the agent slot key plus the badge. */
function internKey(tones: PartTones, blink = false): Record<string, string> {
  return { ...keyFor(tones, { blink }), ...EXTRA_KEY };
}

/** Interns, head pose: they stand (no desk), so the head bows 2 rows, eyes closed, arms hanging. */
const INTERN_HEAD_DOWN: HeadDown = { bow: 2 };

/**
 * The 24x36 frame of an intern look (mirrors `composeCharacter`). Layers, back
 * to front: shadow, build, head (eyes closed in frame 3), face extra, hair,
 * accessory. Frame 1 moves every row above the build's `waist` down 1 px;
 * frames 0 and 2 are the rest pose. The pose frames (POSE_FRAMES) are drawn by
 * compose.ts `posed`, as for agents. Look indices wrap, so any look composes.
 */
export function composeIntern(look: CharacterLook, frame: CharacterFrame = 0): Raster {
  const build = at(INTERN_BUILDS, look.build);
  const hairDef = at(INTERN_HAIRS, look.hair);
  const accessory = ACCESSORY_BY_NAME[at(INTERN_ACCESSORIES, look.accessory)];
  const face = at(FACE_BY_INDEX, look.face);
  const tones = tonesFor(look);
  const key = internKey(tones);
  const { head, shadow, waist } = build.anchors;
  const heads = (blink: boolean, withFace: boolean): Layer[] => {
    const hair = onHead(hairDef, key, head);
    const layers: Layer[] = [layer(INTERN_HEAD, blink ? internKey(tones, true) : key, head.x, head.y)];
    if (withFace && face !== null) layers.push(onHead(face, key, head));
    layers.push(accessory === CAP ? underCap(hair, head) : hair);
    if (accessory !== null) layers.push(onHead(accessory, key, head));
    return layers;
  };
  const shadowLayer = layer(INTERN_SHADOW, key, shadow.x, shadow.y);
  if (typeof frame === 'string') {
    return posed({ build, key, overlay: null, jacket: false, shadow: shadowLayer, heads }, frame, INTERN_W, INTERN_H, INTERN_HEAD_DOWN);
  }
  const layers: Layer[] = [shadowLayer, layer(build, key, 0, 0), ...heads(frame === 3, true)];
  const still = compose(INTERN_W, INTERN_H, layers);
  return frame === 1 ? shiftRows(still, 0, waist.y, 1) : still;
}

/** Variant counts this family draws, checked against INTERN_SPACE by the tests. */
export const INTERN_COUNTS = {
  build: INTERN_BUILDS.length,
  hair: INTERN_HAIRS.length,
  accessory: INTERN_ACCESSORY_PARTS.length + 1,
} as const satisfies Partial<Record<keyof typeof INTERN_SPACE, number>>;
