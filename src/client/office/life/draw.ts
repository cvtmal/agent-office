// Geometry and rasters of what `mount.ts` draws over the characters (research R6, R7):
// the speech bubble box (icon + text, in the name tag's colours), where a bubble sits
// above its tag with a tail at the head, where a context meter sits under the tag and
// where the sweat drop goes beside the head. Pure and DOM-free; the canvas calls stay in
// mount.ts.
import { SCENE_HEIGHT, SCENE_WIDTH, type ActivityKind } from '../../../shared/constants.js';
import { GLYPH_ROWS, measure, textRaster } from '../../render/font.js';
import { rgba } from '../../render/palette.js';
import { blank, blit, type Raster } from '../../render/raster.js';
import { iconId, ICON_SIZE } from '../../sprites/icons/index.js';
import { rasterizeSprite, spriteById } from '../../sprites/registry.js';
import { TAG_FILL, TAG_INK, TAG_OUTLINE } from '../tags.js';
import type { Rect } from '../layout.js';
import { meterSize } from './meter.js';

/** Px around a bubble's content: outline 1 + padding 2 (left/right), outline 1 + padding 1 (top/bottom). */
const PAD_X = 3;
const PAD_Y = 2;
/** Px between the icon and the text. */
const ICON_GAP = 2;
/** Bubble box height: the icon plus top and bottom padding and outline. */
export const BUBBLE_H = Math.max(ICON_SIZE, GLYPH_ROWS) + 2 * PAD_Y;
/** Rows of the tail under the box (3 px wide, then 1 px). */
export const TAIL_H = 2;

/** Width of the bubble box for `text`. */
export function bubbleWidth(text: string): number {
  return PAD_X + ICON_SIZE + ICON_GAP + measure(text) + PAD_X;
}

/**
 * The bubble box (R6): night0 outline with cut corners, night1 fill, the kind's 8x8 icon
 * on the left and `text` in cream, like a name tag. No tail (see `placeBubble`).
 */
export function bubbleRaster(kind: ActivityKind, text: string): Raster {
  const w = bubbleWidth(text);
  const h = BUBBLE_H;
  const out = blank(w, h);
  const outline = rgba(TAG_OUTLINE);
  const fill = rgba(TAG_FILL);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const edgeX = x === 0 || x === w - 1;
      const edgeY = y === 0 || y === h - 1;
      if (edgeX && edgeY) continue; // cut corners
      out.data.set(edgeX || edgeY ? outline : fill, (y * w + x) * 4);
    }
  }
  const icon = spriteById(iconId(kind));
  if (icon !== undefined) blit(out, rasterizeSprite(icon), PAD_X, PAD_Y);
  blit(out, textRaster(text, TAG_INK), PAD_X + ICON_SIZE + ICON_GAP, PAD_Y + Math.floor((ICON_SIZE - GLYPH_ROWS) / 2));
  return out;
}

/** Where a bubble box goes and where its tail starts (left px of the 3-px tail row). */
export interface BubblePlace {
  x: number;
  y: number;
  tailX: number;
}

/**
 * A `w`-wide bubble centred on `headX`, its tail ending 1 px above `tagTop` (the bubble
 * sits above the name tag), clamped inside the 480x270 scene; the tail stays under the
 * box and as close to `headX` as the box allows.
 */
export function placeBubble(w: number, headX: number, tagTop: number): BubblePlace {
  const x = Math.min(Math.max(Math.round(headX - w / 2), 0), SCENE_WIDTH - w);
  const y = Math.min(Math.max(tagTop - 1 - TAIL_H - BUBBLE_H, 0), SCENE_HEIGHT - BUBBLE_H - TAIL_H);
  const tailX = Math.min(Math.max(Math.round(headX) - 1, x + 1), x + w - 4);
  return { x, y, tailX };
}

/** A bubble as `placeBubble` placed it, for `placeBubbles`. */
export interface BubbleBox {
  id: string;
  w: number;
  place: BubblePlace;
}

/** A character's name tag in scene px, for `placeBubbles`. */
export interface TagBox {
  id: string;
  rect: Rect;
}

/** Px a crowded bubble moves up per step: one bubble with its tail, plus 1 px. */
export const BUBBLE_STEP = BUBBLE_H + TAIL_H + 1;
/** Steps a crowded bubble may move up before it stays where it is. */
export const BUBBLE_MAX_STEPS = 2;
/** Px per sideways step of a bubble that found no free height (`placeBubbles`). */
export const BUBBLE_SLIDE = 4;

function overlaps(a: Rect, b: Rect): boolean {
  return a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h;
}

/**
 * Bubbles that do not cover each other or a neighbour's tag (#5 weak art): in stable
 * `id` order, a bubble (box and tail) that overlaps an earlier-placed bubble or another
 * character's tag moves up by `BUBBLE_STEP`, at most `BUBBLE_MAX_STEPS` times, never
 * above the scene's top. If no height is free (near the top of the scene) it slides
 * sideways by `BUBBLE_SLIDE` steps at those heights, its tail still under it. Its own tag
 * is ignored; `tailX` stays. With no free place it ends where moving up left it.
 */
export function placeBubbles(bubbles: readonly BubbleBox[], tags: readonly TagBox[]): Map<string, BubblePlace> {
  const out = new Map<string, BubblePlace>();
  const placed: Rect[] = [];
  const sorted = [...bubbles].sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
  for (const b of sorted) {
    const blockers = [...placed, ...tags.filter((t) => t.id !== b.id).map((t) => t.rect)];
    const box = (x: number, y: number): Rect => ({ x, y, w: b.w, h: BUBBLE_H + TAIL_H });
    const free = (x: number, y: number): boolean => !blockers.some((r) => overlaps(box(x, y), r));
    const ys = [b.place.y];
    for (let step = 0; step < BUBBLE_MAX_STEPS && (ys[ys.length - 1] ?? 0) > 0; step++) {
      ys.push(Math.max((ys[ys.length - 1] ?? 0) - BUBBLE_STEP, 0));
    }
    const lo = Math.max(0, b.place.tailX - b.w + 4);
    const hi = Math.min(SCENE_WIDTH - b.w, b.place.tailX - 1);
    const xs: number[] = [];
    for (let d = BUBBLE_SLIDE; d < b.w; d += BUBBLE_SLIDE) xs.push(b.place.x + d, b.place.x - d);
    const sideways = ys.flatMap((y) => xs.filter((x) => x >= lo && x <= hi).map((x) => ({ x, y })));
    const at =
      ys.map((y) => ({ x: b.place.x, y })).find((p) => free(p.x, p.y)) ??
      sideways.find((p) => free(p.x, p.y)) ?? { x: b.place.x, y: ys[ys.length - 1] ?? b.place.y };
    out.set(b.id, { ...b.place, x: at.x, y: at.y });
    placed.push(box(at.x, at.y));
  }
  return out;
}

/**
 * The context meter's rect (R7): centred on the frame, 1 px under the tag's bottom, but
 * never over the head (`headY`, the first opaque row in scene px).
 */
export function meterRect(frame: Pick<Rect, 'x' | 'w'>, tagBottom: number, headY: number, intern: boolean): Rect {
  const { w, h } = meterSize(intern);
  return {
    x: Math.round(frame.x + (frame.w - w) / 2),
    y: Math.min(tagBottom + 1, headY - h),
    w,
    h,
  };
}

/** Top-left of the sweat drop (5x7): right of the head, level with the brow. */
export function sweatAt(frame: Pick<Rect, 'x' | 'w'>, headY: number, intern: boolean): { x: number; y: number } {
  return {
    x: Math.round(frame.x + frame.w / 2 + (intern ? 5 : 7)),
    y: headY + 2,
  };
}
