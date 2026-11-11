// Name tags (plan P-13): text, truncation, the tag box raster (pixel font in a
// night-outlined dark-purple box) and overlap-free placement above the heads. DOM-free.
import { SCENE_WIDTH } from '../../shared/constants.js';
import type { Character } from '../../shared/types.js';
import { GLYPH_ROWS, measure, textRaster } from '../render/font.js';
import { rgba } from '../render/palette.js';
import { blank, blit, type Raster } from '../render/raster.js';

/** Most glyphs a tag shows; longer text is cut to `TAG_MAX - 1` glyphs plus `…`. */
export const TAG_MAX = 10;

/** How far (px) an overlapping tag moves up per step. */
export const TAG_STEP = 7;

/** Default tag box height in px: 7 glyph rows + 1-px padding and 1-px outline above and below. */
export const TAG_HEIGHT = GLYPH_ROWS + 4;

/** Gap in px between a tag's bottom and the top of the head. */
export const TAG_GAP = 3;

/** Tag colours (P-13): night outline, dark-purple fill, cream text. */
export const TAG_OUTLINE = 'night0';
export const TAG_FILL = 'night1';
export const TAG_INK = 'lamp2';

/** Most upward moves a tag makes to get clear of earlier tags. */
export const TAG_MAX_STEPS = 3;

/** Tag text: `name`, else `agentType`, else the first 8 chars of `id`. */
export function tagText(c: Pick<Character, 'name' | 'agentType' | 'id'>): string {
  if (c.name !== '') return c.name;
  if (c.agentType !== null && c.agentType !== '') return c.agentType;
  return c.id.slice(0, 8);
}

/** At most `TAG_MAX` glyphs (code points): longer text becomes 9 glyphs + `…`. */
export function truncateTag(text: string): string {
  const glyphs = [...text];
  return glyphs.length <= TAG_MAX ? text : `${glyphs.slice(0, TAG_MAX - 1).join('')}…`;
}

/** One tag to place: `x` is the tag's centre, `y` its bottom (3 px above the head), `w` its box width. */
export interface TagInput {
  id: string;
  x: number;
  y: number;
  w: number;
  /** Draw order key (the character's sortY); defaults to `y`. */
  sortY?: number;
}

/** A placed tag: top-left of its box. */
export interface PlacedTag {
  id: string;
  x: number;
  y: number;
}

interface Box {
  x: number;
  y: number;
  w: number;
  h: number;
}

function overlaps(a: Box, b: Box): boolean {
  return a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h;
}

/**
 * Places tags centred on `x` with their bottom at `y` (box height `h`). In order of
 * (sortY, x, id), each tag that overlaps an already placed one moves up `TAG_STEP` px,
 * repeated until free or `TAG_MAX_STEPS` moves. Result keeps that order.
 */
export function placeTags(items: readonly TagInput[], h = TAG_HEIGHT): PlacedTag[] {
  const order = [...items].sort(
    (a, b) => (a.sortY ?? a.y) - (b.sortY ?? b.y) || a.x - b.x || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0),
  );
  const placed: Box[] = [];
  const out: PlacedTag[] = [];
  for (const it of order) {
    const box: Box = { x: Math.round(it.x - it.w / 2), y: it.y - h, w: it.w, h };
    for (let step = 0; step < TAG_MAX_STEPS && placed.some((p) => overlaps(p, box)); step++) box.y -= TAG_STEP;
    placed.push(box);
    out.push({ id: it.id, x: box.x, y: box.y });
  }
  return out;
}

/** Box width in px of the tag showing `text`: the text plus 1-px padding and 1-px outline per side. */
export function tagWidth(text: string): number {
  return measure(text) + 4;
}

/** The tag box of `text` (P-13): `tagWidth(text)` x `TAG_HEIGHT`, outline, fill, cream text. */
export function tagRaster(text: string): Raster {
  const w = tagWidth(text);
  const out = blank(w, TAG_HEIGHT);
  const outline = rgba(TAG_OUTLINE);
  const fill = rgba(TAG_FILL);
  for (let y = 0; y < TAG_HEIGHT; y++) {
    for (let x = 0; x < w; x++) {
      const edge = x === 0 || y === 0 || x === w - 1 || y === TAG_HEIGHT - 1;
      out.data.set(edge ? outline : fill, (y * w + x) * 4);
    }
  }
  blit(out, textRaster(text, TAG_INK), 2, 2);
  return out;
}

/** First row of `r` with an opaque pixel (the top of the head in a character frame); `r.h` if none. */
export function inkTop(r: Raster): number {
  for (let y = 0; y < r.h; y++) {
    for (let x = 0; x < r.w; x++) if ((r.data[(y * r.w + x) * 4 + 3] ?? 0) > 0) return y;
  }
  return r.h;
}

/** One tagged character: its frame (top-left `x, y`, width `w`), draw order, text and head top in the frame. */
export interface TagSubject {
  id: string;
  text: string;
  x: number;
  y: number;
  w: number;
  sortY: number;
  /** First opaque row of the character's frame (`inkTop`). */
  headTop: number;
}

/** A placed tag with its text: top-left of its box. */
export interface PlacedTextTag extends PlacedTag {
  text: string;
}

/**
 * Tags of `subjects`: centred over each frame (kept inside the scene's width), bottom
 * `TAG_GAP` px above the head, then `placeTags`. Subjects with empty text get no tag.
 */
export function layoutTags(subjects: readonly TagSubject[]): PlacedTextTag[] {
  const texts = new Map<string, string>();
  const inputs: TagInput[] = [];
  for (const s of subjects) {
    if (s.text === '') continue;
    const w = tagWidth(s.text);
    const half = w / 2;
    const x = Math.min(Math.max(s.x + s.w / 2, half), SCENE_WIDTH - half);
    texts.set(s.id, s.text);
    inputs.push({ id: s.id, x, y: s.y + s.headTop - TAG_GAP, w, sortY: s.sortY });
  }
  return placeTags(inputs).map((t) => ({ ...t, text: texts.get(t.id) ?? '' }));
}
