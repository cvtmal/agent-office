// The office's pixel font (plan Phase 4): proportional glyphs drawn as code for
// printable ASCII 32-126 plus `…`. Every glyph is 7 rows: cap height 5 (rows
// 0-4, baseline under row 4), descender 2 (rows 5-6); lowercase has x-height 4
// (rows 1-4) with 1-px ascenders. Advance = glyph width + 1. DOM-free.
import { blank, type Raster } from './raster.js';
import { rgba } from './palette.js';

/** Rows of every glyph. */
export const GLYPH_ROWS = 7;
/** Height of capitals and digits. */
export const CAP_HEIGHT = 5;
/** Blank column after every glyph. */
export const TRACKING = 1;
/** Drawn for any character without a glyph. */
export const FALLBACK = '?';

/** One glyph: `rows` are GLYPH_ROWS strings of width `w`, `#` = ink, `.` = empty. */
export interface Glyph {
  w: number;
  rows: readonly string[];
}

// [char, rows separated by spaces]; rows left out at the bottom are empty.
const DEFS: readonly (readonly [string, string])[] = [
  [' ', '.. .. .. .. ..'],
  ['!', '# # # . #'],
  ['"', '#.# #.#'],
  ['#', '.#.#. ##### .#.#. ##### .#.#.'],
  ['$', '.## ##. .#. .## ##.'],
  ['%', '#.# ..# .#. #.. #.#'],
  ['&', '.#.. #.#. .#.. #.## .##.'],
  ["'", '# #'],
  ['(', '.# #. #. #. .#'],
  [')', '#. .# .# .# #.'],
  ['*', '... #.# .#. #.#'],
  ['+', '... .#. ### .#.'],
  [',', '.. .. .. .. .# #.'],
  ['-', '... ... ###'],
  ['.', '. . . . #'],
  ['/', '..# ..# .#. #.. #..'],
  ['0', '.#. #.# #.# #.# .#.'],
  ['1', '.#. ##. .#. .#. ###'],
  ['2', '##. ..# .#. #.. ###'],
  ['3', '##. ..# .#. ..# ##.'],
  ['4', '#.# #.# ### ..# ..#'],
  ['5', '### #.. ##. ..# ##.'],
  ['6', '.## #.. ##. #.# .#.'],
  ['7', '### ..# ..# .#. .#.'],
  ['8', '.#. #.# .#. #.# .#.'],
  ['9', '.#. #.# .## ..# ##.'],
  [':', '. # . # .'],
  [';', '.. .# .. .# #.'],
  ['<', '..# .#. #.. .#. ..#'],
  ['=', '... ### ... ###'],
  ['>', '#.. .#. ..# .#. #..'],
  ['?', '##. ..# .#. ... .#.'],
  ['@', '.##. #..# #.## #... .###'],
  ['A', '.#. #.# ### #.# #.#'],
  ['B', '##. #.# ##. #.# ##.'],
  ['C', '.## #.. #.. #.. .##'],
  ['D', '##. #.# #.# #.# ##.'],
  ['E', '### #.. ##. #.. ###'],
  ['F', '### #.. ##. #.. #..'],
  ['G', '.## #.. #.# #.# .##'],
  ['H', '#.# #.# ### #.# #.#'],
  ['I', '### .#. .#. .#. ###'],
  ['J', '..# ..# ..# #.# .#.'],
  ['K', '#.# #.# ##. #.# #.#'],
  ['L', '#.. #.. #.. #.. ###'],
  ['M', '#...# ##.## #.#.# #...# #...#'],
  ['N', '#..# ##.# #.## #..# #..#'],
  ['O', '.##. #..# #..# #..# .##.'],
  ['P', '##. #.# ##. #.. #..'],
  ['Q', '.##. #..# #..# #.#. .#.#'],
  ['R', '##. #.# ##. #.# #.#'],
  ['S', '.## #.. .#. ..# ##.'],
  ['T', '### .#. .#. .#. .#.'],
  ['U', '#.# #.# #.# #.# ###'],
  ['V', '#.# #.# #.# .#. .#.'],
  ['W', '#...# #...# #.#.# ##.## #...#'],
  ['X', '#.# #.# .#. #.# #.#'],
  ['Y', '#.# #.# .#. .#. .#.'],
  ['Z', '### ..# .#. #.. ###'],
  ['[', '## #. #. #. ##'],
  ['\\', '#.. #.. .#. ..# ..#'],
  [']', '## .# .# .# ##'],
  ['^', '.#. #.#'],
  ['_', '... ... ... ... ... ###'],
  ['`', '#. .#'],
  ['a', '... .## #.# #.# .##'],
  ['b', '#.. ##. #.# #.# ##.'],
  ['c', '... .## #.. #.. .##'],
  ['d', '..# .## #.# #.# .##'],
  ['e', '... .#. ### #.. .##'],
  ['f', '.## #.. ##. #.. #..'],
  ['g', '... .## #.# #.# .## ..# ##.'],
  ['h', '#.. ##. #.# #.# #.#'],
  ['i', '# . # # #'],
  ['j', '.# .. .# .# .# .# #.'],
  ['k', '#.. #.. #.# ##. #.#'],
  ['l', '#. #. #. #. .#'],
  ['m', '..... ####. #.#.# #.#.# #.#.#'],
  ['n', '... ##. #.# #.# #.#'],
  ['o', '... .#. #.# #.# .#.'],
  ['p', '... ##. #.# #.# ##. #.. #..'],
  ['q', '... .## #.# #.# .## ..# ..#'],
  ['r', '... .## #.. #.. #..'],
  ['s', '... .## #.. ..# ##.'],
  ['t', '.#. ### .#. .#. ..#'],
  ['u', '... #.# #.# #.# .##'],
  ['v', '... #.# #.# #.# .#.'],
  ['w', '..... #...# #...# #.#.# .#.#.'],
  ['x', '... #.# .#. .#. #.#'],
  ['y', '... #.# #.# #.# .## ..# ##.'],
  ['z', '... ### .#. #.. ###'],
  ['{', '.## .#. ##. .#. .##'],
  ['|', '# # # # #'],
  ['}', '##. .#. .## .#. ##.'],
  ['~', '.... .#.# #.#.'],
  ['…', '..... ..... ..... ..... #.#.#'],
];

function parse(ch: string, def: string): Glyph {
  const given = def.split(' ');
  const w = given[0]?.length ?? 0;
  if (given.length > GLYPH_ROWS || given.some((row) => row.length !== w || /[^#.]/.test(row))) {
    throw new Error(`font: bad glyph for '${ch}'`);
  }
  const rows = [...given, ...Array<string>(GLYPH_ROWS - given.length).fill('.'.repeat(w))];
  return { w, rows };
}

/** Every glyph by character. */
export const GLYPHS: ReadonlyMap<string, Glyph> = new Map(DEFS.map(([ch, def]) => [ch, parse(ch, def)]));

const fallback = GLYPHS.get(FALLBACK) as Glyph;

/** The glyph drawn for `ch` (the `?` glyph when there is none). */
export function glyph(ch: string): Glyph {
  return GLYPHS.get(ch) ?? fallback;
}

/** Width in px of `text` drawn with `textRaster`: glyph widths plus 1 px between glyphs (none after the last). */
export function measure(text: string): number {
  let w = 0;
  let n = 0;
  for (const ch of text) {
    w += glyph(ch).w;
    n++;
  }
  return n === 0 ? 0 : w + (n - 1) * TRACKING;
}

/**
 * `text` as a measure(text) x GLYPH_ROWS raster: ink in palette colour `fg`,
 * the rest `bg` if given, else transparent.
 */
export function textRaster(text: string, fg: string, bg?: string): Raster {
  const out = blank(measure(text), GLYPH_ROWS);
  if (bg !== undefined) {
    const px = rgba(bg);
    for (let i = 0; i < out.w * out.h; i++) out.data.set(px, i * 4);
  }
  const ink = rgba(fg);
  let x0 = 0;
  for (const ch of text) {
    const g = glyph(ch);
    g.rows.forEach((row, y) => {
      for (let x = 0; x < g.w; x++) {
        if (row.charAt(x) === '#') out.data.set(ink, (y * out.w + x0 + x) * 4);
      }
    });
    x0 += g.w + TRACKING;
  }
  return out;
}
