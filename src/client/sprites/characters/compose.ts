// Paper-doll composition (plan step 3.3, P-5, P-6, P-10): one look + one idle
// frame -> a 32x48 raster. Phases 10-11 add parts to BUILDS/HAIRS (and the
// overlay, face and accessory layers); the layering and colouring here stay.
//
// Layer order, back to front (phase 13 wires every look field):
//   1 shadow     SHADOW at the build's `shadow` anchor
//   2 build      the body, at (0, 0)
//   3 overlay    tie / hoodie strings / open jacket at `overlayFor(overlay, build)`
//   4 head       HEAD at the build's `head` anchor (eyes closed in frame 3)
//   5 face       glasses / beard, its `anchors.head` on the build's `head`; glasses
//                frames in the accent shade (like the interns'), not the outline
//   6 hair       the look's hair style, likewise; under a cap or beanie every hair
//                pixel above the hat's top edge (per column) is cleared, so tall
//                styles do not poke through the crown
//   7 accessory  headphones / cap / beanie / hoops; the beanie is knitted in the
//                cloth set's accent (not the top), so it does not always match the shirt
// Head parts reach up to 4 px above the head box; on builds with a high head
// (head.y 3: tall, broad, lanky) the overflowing rows are dropped below the part's
// top row instead of clipping that row, so the top outline stays (`fitTop`).
//
// Colour: every part is drawn in the slot alphabet (builds.ts); `tonesFor(look)`
// picks the ramps of the look and `keyFor` turns them into the rasterize key.
// DOM-free.
import { compose, rasterize, shiftRows, type Grid, type Layer, type Raster } from '../../render/raster.js';
import type { SpriteDef } from '../types.js';
import { BUILDS, CHAR_H, CHAR_W, DEFAULT_TONES, SHADOW, keyFor, type PartTones } from './builds.js';
import { HAIRS, HEAD, accessoryFor, faceFor, headPartKey, type HeadPartDef } from './heads.js';
import { overlayFor } from './overlays.js';
import { armGeometry, dropArms, flatArms, liftFoot, raisedArms, type PoseFrame } from './poses.js';
import { ACCESSORIES, FACES, HAIR_RAMPS, OVERLAYS, SKINS, type LookField } from './space.js';

export { POSE_FRAMES, type PoseFrame } from './poses.js';

/** The look fields composition reads (structurally the `Look` of office/look.ts). */
export type CharacterLook = Readonly<Record<LookField, number>>;

/** Idle frames (P-10): 0 rest, 1 breathe, 2 rest, 3 blink. */
export type IdleFrame = 0 | 1 | 2 | 3;

/** Any frame of a look: an idle frame 0-3 or a pose (POSE_FRAMES, poses.ts). */
export type CharacterFrame = IdleFrame | PoseFrame;

/**
 * Cloth materials: 3 palette tones each, dark -> light (deep fold, shade, base).
 * Cloth ramps have 2 tones, so the deep fold borrows night1 (cool cloth) or
 * wood0 (warm cloth), which keeps shadows leaning purple / warm brown.
 */
export const MATERIALS = {
  denim: ['night1', 'blue0', 'blue1'],
  moss: ['night1', 'green0', 'green1'],
  berry: ['night1', 'magenta0', 'magenta1'],
  rust: ['wood0', 'orange0', 'orange1'],
  slate: ['night0', 'night2', 'night3'],
  cocoa: ['night1', 'wood0', 'wood1'],
  khaki: ['wood0', 'wood2', 'wood3'],
  cream: ['night3', 'night4', 'lamp2'],
  mustard: ['wood1', 'lamp0', 'lamp1'],
} as const satisfies Record<string, readonly [string, string, string]>;

/** Name of a cloth material. */
export type Material = keyof typeof MATERIALS;

/** One cloth set of P-6: a material per clothing part. */
export interface ClothSet {
  top: Material;
  trousers: Material;
  shoes: Material;
  accent: Material;
}

/** The 6 cloth sets, by look `palette` index (P-5, P-6). Tops all differ, so palettes tell people apart first. */
export const CLOTH_SETS: readonly ClothSet[] = [
  { top: 'rust', trousers: 'denim', shoes: 'cream', accent: 'cocoa' },
  { top: 'denim', trousers: 'khaki', shoes: 'slate', accent: 'rust' },
  { top: 'slate', trousers: 'khaki', shoes: 'cream', accent: 'berry' },
  { top: 'moss', trousers: 'cocoa', shoes: 'slate', accent: 'mustard' },
  { top: 'berry', trousers: 'slate', shoes: 'cream', accent: 'moss' },
  { top: 'mustard', trousers: 'slate', shoes: 'cocoa', accent: 'denim' },
];

/** Hair tones (dark = the hair's outline, base, light) by HAIR_RAMPS index: black, brown, blonde, ginger, grey. */
export const HAIR_TONES: Readonly<Record<(typeof HAIR_RAMPS)[number], readonly [string, string, string]>> = {
  black: ['night0', 'night1', 'night2'],
  brown: ['wood0', 'wood1', 'wood2'],
  blonde: ['wood1', 'lamp0', 'lamp1'],
  ginger: ['wood0', 'orange0', 'orange1'],
  grey: ['night2', 'night3', 'night4'],
};

/** Item `i` of a part list, wrapping: lets every look compose while phases 10-11 fill the lists (a no-op once full). */
function pick<T>(list: readonly T[], i: number): T {
  const item = list[((i % list.length) + list.length) % list.length];
  if (item === undefined) throw new Error('empty part list');
  return item;
}

/** The palette tones of every part for one look. */
export function tonesFor(look: CharacterLook): PartTones {
  const cloth = pick(CLOTH_SETS, look.palette);
  const skin = pick(SKINS, look.skin);
  const hair = HAIR_TONES[pick(HAIR_RAMPS, look.hairRamp)];
  return {
    ...DEFAULT_TONES,
    skin: [`${skin}0`, `${skin}1`, `${skin}2`],
    top: MATERIALS[cloth.top],
    trousers: MATERIALS[cloth.trousers],
    shoes: MATERIALS[cloth.shoes],
    accent: MATERIALS[cloth.accent],
    hair,
  };
}

/** Look index `i` wrapped into [0, n) (out-of-range indices still compose). */
function wrap(i: number, n: number): number {
  return ((i % n) + n) % n;
}

/** One part rasterised with a key, placed at (dx, dy). */
function layer(def: SpriteDef, key: Readonly<Record<string, string>>, dx: number, dy: number): Layer {
  return { raster: rasterize(def.grid, key, undefined, def.id), dx, dy };
}

/**
 * A layer that starts `k` rows above the frame keeps its top row: rows 1..k are
 * dropped instead of rows 0..k-1, so a tall hair style or hat loses a row of its
 * body, not its outline. Rows below keep their frame position.
 */
export function fitTop(l: Layer): Layer {
  const k = -l.dy;
  const r = l.raster;
  if (k <= 0 || k >= r.h - 1) return l;
  const rowBytes = r.w * 4;
  const out: Raster = {
    w: r.w,
    h: r.h - k,
    data: new Uint8ClampedArray(rowBytes * (r.h - k)),
  };
  out.data.set(r.data.subarray(0, rowBytes), 0);
  out.data.set(r.data.subarray(rowBytes * (k + 1)), rowBytes);
  return { raster: out, dx: l.dx, dy: 0 };
}

/** Frame row of the topmost opaque pixel of `l` in frame column `fx`, or null. */
function topIn(l: Layer, fx: number): number | null {
  const x = fx - l.dx;
  if (x < 0 || x >= l.raster.w) return null;
  for (let y = 0; y < l.raster.h; y++) if ((l.raster.data[(y * l.raster.w + x) * 4 + 3] ?? 0) > 0) return y + l.dy;
  return null;
}

/**
 * Hair under a hat: clears every hair pixel above the hat's top edge in its column;
 * where the hat has no pixels, above `brow` (the eyebrow row, which always stays).
 */
export function underHat(hair: Layer, hat: Layer, brow: number): Layer {
  const r = hair.raster;
  const out: Raster = { w: r.w, h: r.h, data: new Uint8ClampedArray(r.data) };
  for (let x = 0; x < r.w; x++) {
    const top = topIn(hat, hair.dx + x) ?? brow;
    for (let y = 0; y < r.h && hair.dy + y < top; y++) out.data.fill(0, (y * r.w + x) * 4, (y * r.w + x) * 4 + 4);
  }
  return { ...hair, raster: out };
}

/** Accessories that cover the crown (hair above them is hidden). */
const HATS: ReadonlySet<string> = new Set(['cap', 'beanie']);

/** Head row of the eyebrows (heads.ts: hair layer, head row 4). */
const BROW_ROW = 4;

/** The pieces of one look a pose needs, shared by agents and interns (interns/index.ts). */
export interface PoseDoll {
  /** The body grid in slot chars, with its head and waist anchors. */
  build: SpriteDef & { anchors: Readonly<Record<'head' | 'waist', { x: number; y: number }>> };
  key: Readonly<Record<string, string>>;
  /** Clothing overlay over the body, or null. */
  overlay: Layer | null;
  /** The overlay is the open jacket: raised and folded arms take its colours. */
  jacket: boolean;
  shadow: Layer;
  /** The head stack at the head anchor, back to front; `face` false leaves out glasses and beard. */
  heads: (blink: boolean, face: boolean) => Layer[];
}

/**
 * Head pose geometry in frame rows: lowered head box top, forearms' top outline, sleeve
 * rows (head on the desk); or, for a figure that stands (interns), `bow`: the head drops
 * that many rows with the eyes closed, the arms keep hanging (no desk to rest on).
 */
export type HeadDown = { top: number; arms: number; fill: number } | { bow: number };

/** Agents, head pose: the forearms lie on rows 18-22, just above the desk line (row 23 of a seated frame, layout.ts). */
const AGENT_HEAD_DOWN: HeadDown = { top: 14, arms: 18, fill: 3 };

/** One agent look taken apart (the layers of the header, ready to stack). */
function doll(look: CharacterLook): PoseDoll {
  const buildIndex = wrap(look.build, BUILDS.length);
  const build = pick(BUILDS, buildIndex);
  const hairDef = pick(HAIRS, look.hair);
  const faceDef = faceFor(wrap(look.face, FACES.length));
  const accessoryName = pick(ACCESSORIES, look.accessory);
  const accessoryDef = accessoryFor(wrap(look.accessory, ACCESSORIES.length));
  const overlayIndex = wrap(look.overlay, OVERLAYS.length);
  const overlay = overlayFor(overlayIndex, buildIndex);
  const tones = tonesFor(look);
  const key = keyFor(tones);
  const headKey = headPartKey(key);
  const { head, shadow } = build.anchors;
  const onHead = (def: HeadPartDef, k: Readonly<Record<string, string>>): Layer =>
    fitTop(layer(def, k, head.x - def.anchors.head.x, head.y - def.anchors.head.y));
  const heads = (blink: boolean, face: boolean): Layer[] => {
    const layers: Layer[] = [layer(HEAD, blink ? keyFor(tones, { blink: true }) : key, head.x, head.y)];
    // Glasses frames (`o`, the only `o` of the face layer) take the accent shade: night0
    // frames around night0 eyes read as sunglasses at 1x, on deep skin most of all.
    if (face && faceDef !== null) layers.push(onHead(faceDef, { ...headKey, o: headKey['m'] ?? 'night0' }));
    let hair = onHead(hairDef, key);
    let accessory: Layer | null = null;
    if (accessoryDef !== null) {
      // The beanie is knitted in the accent material: its top slots t u v take the accent tones k m n.
      const k =
        accessoryName === 'beanie'
          ? {
              ...headKey,
              t: headKey['k'] ?? '',
              u: headKey['m'] ?? '',
              v: headKey['n'] ?? '',
            }
          : headKey;
      accessory = onHead(accessoryDef, k);
      if (HATS.has(accessoryName)) hair = underHat(hair, accessory, head.y + BROW_ROW);
    }
    layers.push(hair);
    if (accessory !== null) layers.push(accessory);
    return layers;
  };
  return {
    build,
    key,
    overlay: overlay === null ? null : layer(overlay.def, key, overlay.dx, overlay.dy),
    jacket: OVERLAYS[overlayIndex] === 'open-jacket',
    shadow: layer(SHADOW, key, shadow.x, shadow.y),
    heads,
  };
}

/**
 * The 32x48 frame of a look. Every look field is drawn (see the header); frame 1
 * moves every row above the build's `waist` down 1 px (breathing: head and
 * shoulders sink onto the belt); frame 3 closes the eyes; frames 0 and 2 are the
 * rest pose. The pose frames (POSE_FRAMES) walk, rest the head on the desk or
 * cheer (`posed`, poses.ts). Look indices wrap, so any look composes.
 */
export function composeCharacter(look: CharacterLook, frame: CharacterFrame = 0): Raster {
  const d = doll(look);
  if (typeof frame === 'string') return posed(d, frame, CHAR_W, CHAR_H, AGENT_HEAD_DOWN);
  const layers: Layer[] = [d.shadow, { raster: rasterize(d.build.grid, d.key, undefined, d.build.id), dx: 0, dy: 0 }];
  if (d.overlay !== null) layers.push(d.overlay);
  layers.push(...d.heads(frame === 3, true));
  const still = compose(CHAR_W, CHAR_H, layers);
  return frame === 1 ? shiftRows(still, 0, d.build.anchors.waist.y, 1) : still;
}

/** A copy of `r`, transparent from row `from` down. */
function cropBelow(r: Raster, from: number): Raster {
  const out: Raster = { w: r.w, h: r.h, data: new Uint8ClampedArray(r.data) };
  out.data.fill(0, Math.max(0, from) * r.w * 4);
  return out;
}

/** `l` with its pixels cleared wherever `g` (frame coordinates) is empty or outline. */
function maskTo(l: Layer, g: Grid): Layer {
  const r = l.raster;
  const out: Raster = { w: r.w, h: r.h, data: new Uint8ClampedArray(r.data) };
  for (let y = 0; y < r.h; y++) {
    for (let x = 0; x < r.w; x++) {
      const c = g[y + l.dy]?.charAt(x + l.dx) ?? '';
      if (c === '' || c === '.' || c === 'o') out.data.fill(0, (y * r.w + x) * 4, (y * r.w + x) * 4 + 4);
    }
  }
  return { ...l, raster: out };
}

/**
 * A pose frame of a look taken apart, `w` x `h` (agents and interns):
 * walk0/2 lift the left/right foot, walk1/3 bob every row down to the belt 1 px;
 * head lowers the head stack (no face extras) to `down.top`, cropped below the
 * forearms, which lie flat over it (with `down.bow`: only bows the head, arms hanging); cheer0/1 replace the hanging arms by raised
 * ones, hands at head row 1 / 0, the jacket masked to the remaining body.
 */
export function posed(d: PoseDoll, pose: PoseFrame, w: number, h: number, down: HeadDown): Raster {
  const grid = (g: Grid): Layer => ({ raster: rasterize(g, d.key, undefined, d.build.id), dx: 0, dy: 0 });
  const { head, waist } = d.build.anchors;
  if (pose === 'head') {
    const stack = compose(w, h, d.heads(true, false));
    const layers: Layer[] = [d.shadow, grid(d.build.grid)];
    if (d.overlay !== null) layers.push(d.overlay);
    if ('bow' in down) {
      layers.push({ raster: compose(w, h, [{ raster: stack, dx: 0, dy: down.bow }]), dx: 0, dy: 0 });
      return compose(w, h, layers);
    }
    const lowered = cropBelow(compose(w, h, [{ raster: stack, dx: 0, dy: down.top - head.y }]), down.arms + down.fill + 2);
    layers.push({ raster: lowered, dx: 0, dy: 0 }, grid(flatArms(w, h, armGeometry(d.build.grid), down.arms, down.fill, d.jacket)));
    return compose(w, h, layers);
  }
  if (pose === 'cheer0' || pose === 'cheer1') {
    const a = armGeometry(d.build.grid);
    const body = dropArms(d.build.grid, a);
    const layers: Layer[] = [d.shadow, grid(body)];
    if (d.overlay !== null) layers.push(d.jacket ? maskTo(d.overlay, body) : d.overlay);
    layers.push(grid(raisedArms(body, a, head.y + (pose === 'cheer0' ? 1 : 0), d.jacket)), ...d.heads(false, true));
    return compose(w, h, layers);
  }
  const lift = pose === 'walk0' ? 'left' : pose === 'walk2' ? 'right' : null;
  const layers: Layer[] = [grid(lift === null ? d.build.grid : liftFoot(d.build.grid, lift))];
  if (d.overlay !== null) layers.push(d.overlay);
  layers.push(...d.heads(false, true));
  const figure = compose(w, h, layers);
  const bobbed = lift === null ? shiftRows(figure, 0, waist.y + 1, 1) : figure;
  return compose(w, h, [d.shadow, { raster: bobbed, dx: 0, dy: 0 }]);
}

/** Variant counts the character parts provide, checked against AGENT_SPACE by the tests. */
export const CHARACTER_COUNTS = {
  build: BUILDS.length,
  hair: HAIRS.length,
  face: FACES.length,
  accessory: ACCESSORIES.length,
  overlay: OVERLAYS.length,
} as const satisfies Partial<Record<LookField, number>>;
