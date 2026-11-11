// The looks gallery (plan P-12, `/?view=looks`): 30 synthetic looks (`look-00` ...
// `look-29`) in two rows of 15 and the looks of the snapshot's characters in a third
// row, standing, on a plain floor, light off. A dev aid for the character
// screenshot loop and the second frame-time measurement (>= 14 characters on
// screen). Each entry carries its tag text for the name tags (#14). DOM-free.
import type { Character } from '../../shared/types.js';
import { FRAME_H, FRAME_W, INTERN_H, INTERN_W } from './layout.js';
import { lookFor } from './look.js';
import type { DrawItem } from './scene.js';
import { tagText, truncateTag } from './tags.js';

/** Number of synthetic gallery looks. */
export const GALLERY_LOOKS = 30;

/** Ids of the synthetic looks: `look-00` ... `look-29`. */
export const GALLERY_IDS: readonly string[] = Array.from(
  { length: GALLERY_LOOKS },
  (_, i) => `look-${String(i).padStart(2, '0')}`,
);

/** Characters per row and the horizontal pitch of their feet anchors. */
export const GALLERY_COLS = 15;
export const GALLERY_PITCH = 30;

/** Feet line (frame bottom) of each row; rows 0-1 synthetic looks, row 2 onwards the snapshot. */
export const GALLERY_ROWS: readonly number[] = [74, 160, 246];

/** One gallery character: a draw item (frame top-left at x, y) with its tag text. */
export interface GalleryEntry extends DrawItem {
  kind: 'character';
  tag: string;
}

/** Feet anchor x of column `col`, centred on the 480-px scene. */
function feetX(col: number): number {
  return 30 + col * GALLERY_PITCH;
}

function entry(id: string, intern: boolean, tag: string, col: number, feetY: number): GalleryEntry {
  const w = intern ? INTERN_W : FRAME_W;
  const h = intern ? INTERN_H : FRAME_H;
  return {
    kind: 'character',
    id,
    look: lookFor(id, intern),
    intern,
    seated: false,
    x: feetX(col) - w / 2,
    y: feetY - h,
    sortY: feetY,
    tag,
  };
}

/**
 * The gallery: GALLERY_IDS (agents) in rows 0-1, then `characters` (interns for
 * `kind: 'agent'`, as in the room) from row 2, centred in their row. Characters
 * beyond the last row are left out. Sorted for drawing (sortY, then x).
 */
export function galleryEntries(
  characters: readonly Pick<Character, 'id' | 'kind' | 'name' | 'agentType'>[],
): GalleryEntry[] {
  const out: GalleryEntry[] = [];
  GALLERY_IDS.forEach((id, i) => {
    const feetY = GALLERY_ROWS[Math.floor(i / GALLERY_COLS)];
    if (feetY !== undefined) out.push(entry(id, false, id, i % GALLERY_COLS, feetY));
  });
  const firstRow = Math.ceil(GALLERY_LOOKS / GALLERY_COLS);
  const rows = GALLERY_ROWS.length - firstRow;
  const shown = characters.slice(0, rows * GALLERY_COLS);
  shown.forEach((c, i) => {
    const row = Math.floor(i / GALLERY_COLS);
    const feetY = GALLERY_ROWS[firstRow + row];
    if (feetY === undefined) return;
    const inRow = Math.min(GALLERY_COLS, shown.length - row * GALLERY_COLS);
    const offset = (GALLERY_COLS - inRow) / 2;
    const col = (i % GALLERY_COLS) + offset;
    out.push(entry(c.id, c.kind === 'agent', truncateTag(tagText(c)), col, feetY));
  });
  return out.sort((a, b) => a.sortY - b.sortY || a.x - b.x);
}
