// Where each drawn character sits on the 480x270 scene, for HTML hit areas over
// the canvas (ui/hotspots.ts). `mountOffice` dispatches `LAYOUT_EVENT` on the
// canvas with `characterBoxes(scene.items)` as `detail` after each rebuild
// (D-025 seam; #5 sets `layoutDirty` when characters move). DOM-free.
import { FRAME_H, FRAME_W, INTERN_H, INTERN_W } from './layout.js';
import type { DrawItem } from './scene.js';

/** CustomEvent type on the office canvas; `detail` is `CharacterBox[]`. */
export const LAYOUT_EVENT = 'office:layout';

/** A character's frame in scene px (top-left `(x, y)`, size `w x h`). */
export interface CharacterBox {
  id: string;
  x: number;
  y: number;
  w: number;
  h: number;
}

/** Character items only, ordered top-to-bottom, then left-to-right, then id (a natural Tab order). */
export function characterBoxes(items: readonly DrawItem[]): CharacterBox[] {
  return items
    .filter((i) => i.kind === 'character')
    .map((i) => ({
      id: i.id,
      x: i.x,
      y: i.y,
      w: i.intern === true ? INTERN_W : FRAME_W,
      h: i.intern === true ? INTERN_H : FRAME_H,
    }))
    .sort((a, b) => a.y - b.y || a.x - b.x || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
}
