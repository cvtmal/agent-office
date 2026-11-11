// The sprite contract every family builds on (plan step 1.6). DOM-free.
import type { Grid } from '../render/raster.js';

export type { Grid } from '../render/raster.js';

/** A named point inside a sprite, in sprite pixels from its top-left. */
export interface Anchor {
  x: number;
  y: number;
}

/** One sprite: a `w` x `h` grid whose chars `key` maps to palette colour names (`.` = transparent). */
export interface SpriteDef {
  /** Unique across all families, e.g. `floor-wood-a`. */
  id: string;
  w: number;
  h: number;
  grid: Grid;
  key: Readonly<Record<string, string>>;
  /** Attachment points, e.g. `head`, `waist`, `seat`. */
  anchors?: Readonly<Record<string, Anchor>>;
}

/** A sprite family: one source folder, one preview sheet `var/sprites/<name>.png`. */
export interface Family {
  name: string;
  sprites: SpriteDef[];
}
