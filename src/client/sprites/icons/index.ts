// Sprite family `icons` (#6, R10, P-6): one 8x8 icon per activity kind for the
// inspector's activity list. Original grids, palette names only (scope P-6). DOM-free.
import { ACTIVITY_KINDS, type ActivityKind } from '../../../shared/constants.js';
import type { Family, Grid, SpriteDef } from '../types.js';

/** Icon edge in px. */
export const ICON_SIZE = 8;

/** Sprite id of a kind's icon (`icon-read`, ...). */
export function iconId(kind: ActivityKind): string {
  return `icon-${kind}`;
}

const OUTLINE = 'night0';

/** Grid and key per kind; `o` is always the night0 outline. */
const ICONS: Readonly<Record<ActivityKind, { grid: Grid; key: Readonly<Record<string, string>> }>> = {
  // Open book: two cream pages on a dark spine.
  read: {
    grid: ['........', '.oo..oo.', 'occoocco', 'occoocco', 'occoocco', 'occoocco', '.oooooo.', '........'],
    key: { o: OUTLINE, c: 'lamp2' },
  },
  // Pencil, tip bottom-left: magenta eraser, gold body, wood tip.
  write: {
    grid: ['......oo', '.....opo', '....oyo.', '...oyo..', '..oyo...', '.oyo....', 'owo.....', 'oo......'],
    key: { o: OUTLINE, p: 'magenta1', y: 'lamp1', w: 'wood3' },
  },
  // Terminal: a dark screen with a green `>_` prompt.
  shell: {
    grid: ['oooooooo', 'okkkkkko', 'ogkkkkko', 'okgkkkko', 'ogkgggko', 'okkkkkko', 'oooooooo', '........'],
    key: { o: OUTLINE, k: 'night1', g: 'screen1' },
  },
  // Globe: blue sea, green land.
  web: {
    grid: ['..oooo..', '.obbggo.', 'obggbbbo', 'obbgbbgo', 'obbbbggo', 'oggbbbbo', '.obbbgo.', '..oooo..'],
    key: { o: OUTLINE, b: 'blue1', g: 'green1' },
  },
  // Folder: gold with an amber tab line.
  delegate: {
    grid: ['........', 'oooo....', 'offfoooo', 'oaaaaaao', 'offffffo', 'offffffo', 'oooooooo', '........'],
    key: { o: OUTLINE, f: 'lamp1', a: 'lamp0' },
  },
  // Sticky note: gold paper with two amber lines.
  plan: {
    grid: ['oooooooo', 'osssssso', 'osllllso', 'osssssso', 'osllllso', 'osssssso', 'osssssso', 'oooooooo'],
    key: { o: OUTLINE, s: 'lamp1', l: 'lamp0' },
  },
  // Dot: a small cream disc.
  other: {
    grid: ['........', '........', '...oo...', '..occo..', '..occo..', '...oo...', '........', '........'],
    key: { o: OUTLINE, c: 'lamp2' },
  },
};

export const iconsFamily: Family = {
  name: 'icons',
  sprites: ACTIVITY_KINDS.map(
    (kind): SpriteDef => ({ id: iconId(kind), w: ICON_SIZE, h: ICON_SIZE, grid: ICONS[kind].grid, key: ICONS[kind].key }),
  ),
};
