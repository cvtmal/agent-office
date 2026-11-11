// Clothing overlays (plan step 10.2, P-5 `overlay` 1-3: `tie`, `hoodie-strings`,
// `open-jacket`), drawn over the build and under the head, in the slot alphabet
// of builds.ts, so they wear the look's cloth set like every other part.
//
// Placement (Phase 13 wires it into compose.ts): `overlayFor(overlay, build)`
// returns the sprite and its frame position (dx, dy) = top-left in the 32x48
// frame; layer it right after the build: `layer(p.def, key, p.dx, p.dy)`. The
// head and hair are drawn after it and cover what lies behind the chin. Idle
// frame 1 shifts it with the rest of the torso (it sits above `waist`, apart
// from the jacket's belt row, which stays with the belt). In terms of the
// build's `torso` anchor (T = torso.y - 1 is the collar row):
//
//   tie             one sprite for every build, 4x10, at (14, T) = torso + (14 - torso.x, -1):
//                   shirt-collar points (`x`, `u`) beside the neck, knot and 2-px blade
//                   in the accent material (`n` lit, `m` shade, `k` deep tip).
//   hoodie-strings  one sprite per width class (narrow, regular, wide), the collar row's
//                   width + 4 wide, at (collar left - 2, T - 2): a hood rolled up around the
//                   neck in the top's tones (`x v u t`, outline `o`; the part behind the
//                   chin is hidden by the head) and two strings in the accent (`n`, aglet `m`)
//                   hanging 5 rows from x 14 and x 17.
//   open-jacket     one sprite per build (it follows the arms, belly and taper), cropped
//                   to its pixels, rows T .. waist: every top px outside a 6-px front
//                   opening (4 px at the collar) turns into accent (`v`/`x` -> `n`,
//                   `u` -> `m`, `t` -> `k`), lapel edges `k`, and the belt's ends become
//                   the jacket's hem; the shirt (top) and the belt show in the opening.
//
// Width classes (BuildDef.width): narrow = slim, short, curvy, lanky (collar 10 px);
// regular = stocky, tall, round (collar 12 px); wide = broad (collar 18 px).
// DOM-free.
import type { SpriteDef } from '../types.js';
import { BUILDS, PART_KEY, type BuildDef, type WidthClass } from './builds.js';
import { OVERLAYS } from './space.js';

/** An overlay sprite and where its top-left falls in the 32x48 frame. */
export interface OverlayPlacement {
  def: SpriteDef;
  dx: number;
  dy: number;
}

/** The frame's centre line: spans are symmetric around x = 15.5. */
const MID = 15.5;

/** Collar-row cloth span of a build (row torso.y - 1): its leftmost and rightmost cloth px. */
function collar(b: BuildDef): readonly [number, number] {
  const row = b.grid[b.anchors.torso.y - 1] ?? '';
  const l = row.search(/[tuvx1]/);
  const r = row.length - 1 - [...row].reverse().join('').search(/[tuvx1]/);
  return [l, r];
}

/** Tie: collar points, knot, a 2-px blade and a dark tip, 4x10. */
const TIE: SpriteDef = {
  id: 'char-overlay-tie',
  w: 4,
  h: 10,
  key: PART_KEY,
  grid: [
    'xnmu', // collar points beside the knot (on the neck row)
    '.km.',
    '.nm.',
    '.nm.',
    '.nm.',
    '.nm.',
    'nnmm', // the blade widens
    'nnmm',
    '.km.', // tip
    '..k.',
  ],
};

/** Hood rolled around the neck plus two strings, for a collar `cw` px wide (even). */
function hoodie(width: WidthClass, cw: number): SpriteDef {
  const w = cw + 4;
  const h = 9;
  const rows = Array.from({ length: h }, () => Array.from({ length: w }, () => '.'));
  const set = (x: number, y: number, c: string): void => {
    const row = rows[y];
    if (row !== undefined && x >= 0 && x < w) row[x] = c;
  };
  // Sprite x 0 = collar left - 2; the frame's centre falls between w/2 - 1 and w/2.
  const mid = w / 2;
  const lump = 3;
  // y 0: top edge of the two lumps; y 1: the lumps; y 2: the rim on the collar row.
  for (let k = 0; k < lump; k++) {
    set(1 + k, 0, 'o');
    set(w - 2 - k, 0, 'o');
    set(1 + k, 1, k === 0 ? 'x' : 'v');
    set(w - 2 - k, 1, k === 0 ? 't' : 'u');
  }
  set(0, 1, 'o');
  set(w - 1, 1, 'o');
  for (let x = 1 + lump; x < w - 1 - lump; x++) set(x, 1, 't'); // back of the hood, behind the neck
  set(0, 2, 'o');
  set(w - 1, 2, 'o');
  // The rim's underside in shade, so the roll stands off the shoulders; dark opening at the neck.
  for (let x = 1; x < w - 1; x++) set(x, 2, x < mid - 2 ? 'u' : 't');
  set(1, 2, 'v');
  // y 3: the opening's shadow in the V; y 3-7: strings, aglet at the end.
  set(mid - 1, 3, 't');
  set(mid, 3, 't');
  for (let y = 3; y <= 7; y++) {
    set(mid - 2, y, y === 7 ? 'm' : 'n');
    set(mid + 1, y, y === 7 ? 'm' : 'n');
  }
  return { id: `char-overlay-hoodie-strings-${width}`, w, h, key: PART_KEY, grid: rows.map((r) => r.join('')) };
}

/** Top slot -> jacket slot (accent material). */
const JACKET: Readonly<Record<string, string>> = { x: 'n', v: 'n', u: 'm', t: 'k' };

/** Open jacket for one build, cropped to its pixels; returns the sprite and its frame offset. */
function jacket(b: BuildDef): OverlayPlacement {
  const T = b.anchors.torso.y - 1;
  const waist = b.anchors.waist.y;
  const name = b.id.replace('char-build-', '');
  const out: string[][] = [];
  for (let y = T; y <= waist; y++) {
    const src = b.grid[y] ?? '';
    const half = y === T ? 2 : 3; // opening: 4 px (the neck) on the collar row, then 6 px
    out.push(
      [...src].map((c, x) => {
        const inOpening = Math.abs(x + 0.5 - MID) < half;
        if (inOpening) return '.';
        const edge = Math.abs(x + 0.5 - MID) < half + 1 && y > T + 1;
        if (y === waist) return c === 'n' || c === 'm' ? (edge ? 'k' : c) : '.';
        const j = JACKET[c];
        if (j === undefined) return '.';
        return edge ? 'k' : j;
      }),
    );
  }
  // Crop to the opaque pixels.
  const cols = out[0]?.length ?? 0;
  let x0 = cols;
  let x1 = -1;
  for (const row of out) {
    row.forEach((c, x) => {
      if (c === '.') return;
      x0 = Math.min(x0, x);
      x1 = Math.max(x1, x);
    });
  }
  const grid = out.map((row) => row.slice(x0, x1 + 1).join(''));
  return { def: { id: `char-overlay-open-jacket-${name}`, w: x1 - x0 + 1, h: grid.length, key: PART_KEY, grid }, dx: x0, dy: T };
}

/** Hoodie sprites by width class, made from the first build of that class. */
const HOODIES = new Map<WidthClass, SpriteDef>();
for (const b of BUILDS) {
  if (HOODIES.has(b.width)) continue;
  const [l, r] = collar(b);
  HOODIES.set(b.width, hoodie(b.width, r - l + 1));
}

/** Placements by [overlay index][build index]; overlay 0 (`none`) has none. */
const PLACEMENTS: readonly (readonly (OverlayPlacement | null)[])[] = OVERLAYS.map((name) =>
  BUILDS.map((b): OverlayPlacement | null => {
    const T = b.anchors.torso.y - 1;
    switch (name) {
      case 'none':
        return null;
      case 'tie':
        return { def: TIE, dx: 14, dy: T };
      case 'hoodie-strings': {
        const def = HOODIES.get(b.width);
        if (def === undefined) throw new Error(`no hoodie for ${b.width}`);
        return { def, dx: collar(b)[0] - 2, dy: T - 2 };
      }
      case 'open-jacket':
        return jacket(b);
    }
  }),
);

/**
 * The overlay sprite of look field `overlay` on build `build`, and where its
 * top-left goes in the frame; `null` for overlay 0 (`none`). Throws on an index
 * outside the look space.
 */
export function overlayFor(overlay: number, build: number): OverlayPlacement | null {
  const row = PLACEMENTS[overlay];
  if (row === undefined || build < 0 || build >= BUILDS.length) {
    throw new Error(`no overlay ${String(overlay)} for build ${String(build)}`);
  }
  return row[build] ?? null;
}

/** Overlay sprites, all registered in the `characters` family: the tie, 3 hoodies, 8 jackets. */
export const OVERLAY_PARTS: readonly SpriteDef[] = [
  ...new Set(PLACEMENTS.flat().flatMap((p) => (p === null ? [] : [p.def]))),
];
