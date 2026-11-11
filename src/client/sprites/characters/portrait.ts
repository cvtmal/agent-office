// Portraits (plan P-11, for the inspector of #6): the head of a look's rest frame,
// cropped and scaled up onto a 48x48 panel with a night fill and a 1-px cream
// border. Agents: a 24x24 crop around the head box, x2. Interns: 16x16, x3.
// The crop is placed on the build's `head` anchor, so the head sits at the same
// place in every portrait (rows above the frame come out as panel fill).
// Detailed portrait parts are carried forward (#7). DOM-free.
import { rgba } from '../../render/palette.js';
import { blank, blit, crop, scale, type Raster } from '../../render/raster.js';
import { INTERN_BUILDS, INTERN_HEAD_BOX, composeIntern } from '../interns/index.js';
import type { Anchor } from '../types.js';
import { BUILDS, HEAD_BOX } from './builds.js';
import { composeCharacter, type CharacterLook } from './compose.js';

/** Portrait panel size in px. */
export const PORTRAIT_SIZE = 48;

/** Panel fill and border colours. */
export const PORTRAIT_FILL = 'night1';
export const PORTRAIT_BORDER = 'lamp2';

/** Crop size and scale per frame kind: crop * scale = PORTRAIT_SIZE. */
const AGENT_CROP = 24;
const INTERN_CROP = 16;

/** Item `i` of a list, wrapping like the composers do. */
function at<T>(list: readonly T[], i: number): T {
  const item = list[((i % list.length) + list.length) % list.length];
  if (item === undefined) throw new Error('empty part list');
  return item;
}

/**
 * Top-left of the crop in the frame: centred on the head box horizontally, with
 * room above it for the tallest hair (agents 4 px + 1, interns 3 px + 1).
 */
export function portraitCrop(look: CharacterLook, intern: boolean): Anchor & { size: number } {
  if (intern) {
    const head = at(INTERN_BUILDS, look.build).anchors.head;
    return { x: head.x + INTERN_HEAD_BOX.w / 2 - INTERN_CROP / 2, y: head.y - 4, size: INTERN_CROP };
  }
  const head = at(BUILDS, look.build).anchors.head;
  return { x: head.x + HEAD_BOX.w / 2 - AGENT_CROP / 2, y: head.y - 5, size: AGENT_CROP };
}

/** The 48x48 portrait of a look (idle frame 0). */
export function portraitFor(look: CharacterLook, intern: boolean): Raster {
  const frame = intern ? composeIntern(look, 0) : composeCharacter(look, 0);
  const c = portraitCrop(look, intern);
  const face = scale(crop(frame, c.x, c.y, c.size, c.size), PORTRAIT_SIZE / c.size);
  const out = blank(PORTRAIT_SIZE, PORTRAIT_SIZE);
  const fill = rgba(PORTRAIT_FILL);
  const border = rgba(PORTRAIT_BORDER);
  for (let y = 0; y < PORTRAIT_SIZE; y++) {
    for (let x = 0; x < PORTRAIT_SIZE; x++) out.data.set(fill, (y * PORTRAIT_SIZE + x) * 4);
  }
  blit(out, face, 0, 0);
  for (let i = 0; i < PORTRAIT_SIZE; i++) {
    for (const [x, y] of [
      [i, 0],
      [i, PORTRAIT_SIZE - 1],
      [0, i],
      [PORTRAIT_SIZE - 1, i],
    ] as const) {
      out.data.set(border, (y * PORTRAIT_SIZE + x) * 4);
    }
  }
  return out;
}
