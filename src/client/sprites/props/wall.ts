// Props: wall sprites (plan step 8.1) — the whiteboard, the done wall (frames
// and sign), shelves, posters, sticky notes, the clock and the theme props of the
// neon room (neon sign, fairy lights, cables) and a hanging plant. Drawn on a
// small char canvas like the shell family. No words or letters anywhere: the
// whiteboard holds diagrams, the done sign a trophy, the neon sign a ringed planet.
// Everything here is original (scope P-6). DOM-free.
import { bookRow, frame, rng } from '../kit.js';
import type { Grid, SpriteDef } from '../types.js';

/** A mutable w x h char canvas, transparent (`.`) at start; shared by the wall and kitchen props. */
export class PropCanvas {
  private readonly px: string[][];

  constructor(
    readonly w: number,
    readonly h: number,
  ) {
    this.px = Array.from({ length: h }, () => Array.from({ length: w }, () => '.'));
  }

  /** Sets one pixel; outside the canvas is ignored. */
  set(x: number, y: number, ch: string): void {
    const row = this.px[y];
    if (row && x >= 0 && x < this.w) row[x] = ch;
  }

  /** The char at (x, y), `.` outside. */
  get(x: number, y: number): string {
    return this.px[y]?.[x] ?? '.';
  }

  /** Fills the rectangle [x, x+w) x [y, y+h). */
  rect(x: number, y: number, w: number, h: number, ch: string): void {
    for (let j = y; j < y + h; j++) for (let i = x; i < x + w; i++) this.set(i, j, ch);
  }

  /** A 1-px rectangle border. */
  border(x: number, y: number, w: number, h: number, ch: string): void {
    this.rect(x, y, w, 1, ch);
    this.rect(x, y + h - 1, w, 1, ch);
    this.rect(x, y, 1, h, ch);
    this.rect(x + w - 1, y, 1, h, ch);
  }

  /** A 1-px line from (x0, y0) to (x1, y1) (Bresenham). */
  line(x0: number, y0: number, x1: number, y1: number, ch: string): void {
    const dx = Math.abs(x1 - x0);
    const dy = -Math.abs(y1 - y0);
    const sx = x0 < x1 ? 1 : -1;
    const sy = y0 < y1 ? 1 : -1;
    let err = dx + dy;
    let x = x0;
    let y = y0;
    for (;;) {
      this.set(x, y, ch);
      if (x === x1 && y === y1) return;
      const e2 = 2 * err;
      if (e2 >= dy) {
        err += dy;
        x += sx;
      }
      if (e2 <= dx) {
        err += dx;
        y += sy;
      }
    }
  }

  /** Calls `paint` for every pixel of the ellipse centred at (cx, cy) (pixel centres, may be .5). */
  ellipse(cx: number, cy: number, rx: number, ry: number, paint: (x: number, y: number, d: number) => void): void {
    for (let y = Math.floor(cy - ry); y <= Math.ceil(cy + ry); y++) {
      for (let x = Math.floor(cx - rx); x <= Math.ceil(cx + rx); x++) {
        const nx = (x - cx) / rx;
        const ny = (y - cy) / ry;
        const d = nx * nx + ny * ny;
        if (d <= 1) paint(x, y, d);
      }
    }
  }

  /** Overwrites with the non-`.` chars of `g` at (dx, dy). */
  paste(g: Grid, dx: number, dy: number): void {
    g.forEach((row, y) => {
      [...row].forEach((ch, x) => {
        if (ch !== '.') this.set(dx + x, dy + y, ch);
      });
    });
  }

  /** Rings every opaque shape with `ch`: transparent pixels with an opaque 4-neighbour (all at once). */
  outline(ch: string, only?: (inner: string) => boolean): void {
    const hits: [number, number][] = [];
    for (let y = 0; y < this.h; y++) {
      for (let x = 0; x < this.w; x++) {
        if (this.get(x, y) !== '.') continue;
        const near = [this.get(x - 1, y), this.get(x + 1, y), this.get(x, y - 1), this.get(x, y + 1)];
        if (near.some((n) => n !== '.' && n !== ch && (only === undefined || only(n)))) hits.push([x, y]);
      }
    }
    for (const [x, y] of hits) this.set(x, y, ch);
  }

  /** The canvas as a grid. */
  grid(): Grid {
    return this.px.map((row) => row.join(''));
  }
}

/** Replaces the last column of every run of one char in each row by its lower-case shade char. */
function shadeRuns(g: Grid): Grid {
  return g.map((row) =>
    [...row].map((ch, x) => (ch !== '.' && row[x + 1] !== ch ? ch.toLowerCase() : ch)).join(''),
  );
}

/**
 * Whiteboard, 96x48: an aluminium frame (lit top/left, shaded bottom/right), a
 * cream board with a shadow under the frame, and marker drawings that are only
 * shapes — a three-column board of cards, a flowchart, a bar chart, a circled
 * star, a timeline — plus a pinned note and a tray with markers and an eraser.
 */
function whiteboard(): Grid {
  const W = 96;
  const c = new PropCanvas(W, 48);
  // Frame and board.
  c.rect(0, 0, W, 42, 'o');
  c.rect(1, 1, W - 2, 40, 'f');
  c.rect(1, 1, W - 2, 1, 'F');
  c.rect(1, 1, 1, 40, 'F');
  c.rect(W - 2, 2, 1, 39, 'g');
  c.rect(2, 40, W - 3, 1, 'g');
  c.rect(3, 3, W - 6, 36, 'w');
  // Shadow of the frame on the board (top and left) and a soft shade lower right.
  c.rect(3, 3, W - 6, 1, 'v');
  c.rect(3, 3, 1, 36, 'v');
  for (let y = 4; y < 39; y++) {
    for (let x = 4; x < W - 3; x++) {
      const t = x + 2 * y;
      if (t > 156 || (t > 148 && (x + y) % 2 === 0) || (t > 142 && x % 2 === 0 && y % 2 === 0)) c.set(x, y, 'v');
    }
  }
  // Glare: two thin diagonal streaks on the upper left.
  for (let i = 0; i < 9; i++) {
    c.set(8 + i, 15 - i, 'v');
    c.set(12 + i, 15 - i, 'v');
  }
  // Card board: three columns under coloured header dashes, cards as small notes.
  c.rect(6, 5, 5, 2, 'b');
  c.rect(16, 5, 5, 2, 'm');
  c.rect(26, 5, 5, 2, 'n');
  c.line(5, 8, 33, 8, 'k');
  c.line(14, 5, 14, 35, 'k');
  c.line(24, 5, 24, 35, 'k');
  const card = (x: number, y: number, base: string, shade: string): void => {
    c.rect(x, y, 7, 4, base);
    c.rect(x, y + 3, 7, 1, shade);
    c.rect(x + 1, y + 1, 4, 1, shade);
  };
  card(6, 10, 'y', 'Y');
  card(6, 15, 'p', 'P');
  card(6, 20, 'y', 'Y');
  card(6, 25, 'q', 'Q');
  card(16, 10, 'q', 'Q');
  card(16, 15, 'y', 'Y');
  card(26, 10, 'n', 'N');
  card(26, 15, 'n', 'N');
  card(26, 20, 'p', 'P');
  // Tick marks next to the done column.
  c.line(28, 27, 29, 28, 'n');
  c.line(29, 28, 32, 25, 'n');
  // Flowchart: box -> box -> box, back to a circle.
  c.border(38, 6, 9, 6, 'b');
  c.border(53, 6, 9, 6, 'b');
  c.border(53, 20, 9, 6, 'b');
  c.line(47, 8, 52, 8, 'b');
  c.set(51, 7, 'b');
  c.set(51, 9, 'b');
  c.line(57, 12, 57, 19, 'b');
  c.set(56, 18, 'b');
  c.set(58, 18, 'b');
  c.ellipse(42.5, 22.5, 3.6, 3.6, (x, y, d) => {
    if (d > 0.45) c.set(x, y, 'm');
  });
  c.line(47, 23, 52, 23, 'b');
  c.set(48, 22, 'b');
  c.set(48, 24, 'b');
  c.line(42, 12, 42, 18, 'k');
  // Timeline with ticks and a milestone dot.
  c.line(38, 32, 62, 32, 'k');
  for (const x of [40, 46, 52, 58]) c.line(x, 31, x, 33, 'k');
  c.rect(51, 30, 3, 2, 'r');
  c.rect(51, 33, 3, 2, 'r');
  c.set(50, 32, 'r');
  c.set(54, 32, 'r');
  // Bar chart with a trend arrow.
  c.line(67, 5, 67, 21, 'k');
  c.line(67, 21, 89, 21, 'k');
  for (const [x, h, ch] of [
    [70, 4, 'q'],
    [74, 7, 'q'],
    [78, 6, 'm'],
    [82, 10, 'n'],
    [86, 13, 'n'],
  ] as const) {
    c.rect(x, 21 - h, 3, h, ch);
  }
  c.line(69, 15, 76, 11, 'r');
  c.line(76, 11, 80, 12, 'r');
  c.line(80, 12, 87, 5, 'r');
  c.set(86, 5, 'r');
  c.set(87, 6, 'r');
  // Circled star and two bullet dashes.
  c.ellipse(83, 30.5, 6.6, 6.1, (x, y, d) => {
    if (d > 0.7) c.set(x, y, 'r');
  });
  c.paste(['...r...', '...r...', 'rrrrrrr', '.rrrrr.', '..rrr..', '.rr.rr.', '.r...r.'], 80, 27);
  for (const y of [26, 30, 34]) {
    c.set(67, y, 'k');
    c.line(69, y, 73 + (y % 3), y, 'k');
  }
  // A pinned note hanging over the top-right frame.
  c.rect(85, 1, 7, 7, 'p');
  c.rect(85, 7, 7, 1, 'P');
  c.rect(86, 4, 4, 1, 'P');
  c.set(88, 1, 'r');
  // Tray: outline, lit lip, body, shade; markers and an eraser lying in it.
  c.rect(3, 42, W - 6, 5, 'o');
  c.rect(4, 43, W - 8, 1, 'F');
  c.rect(4, 44, W - 8, 1, 'f');
  c.rect(4, 45, W - 8, 1, 'g');
  const marker = (x: number, cap: string): void => {
    c.rect(x - 1, 41, 9, 3, 'o');
    c.rect(x, 42, 5, 1, 'w');
    c.rect(x + 5, 42, 2, 1, cap);
  };
  marker(10, 'b');
  marker(20, 'm');
  marker(30, 'k');
  c.rect(68, 40, 10, 2, 'E');
  c.rect(68, 40, 10, 1, 'e');
  c.rect(68, 42, 10, 2, 'k');
  return c.grid();
}

/** Inside of a done frame: x 2..13, y 2..9 of a 16x12 wood frame. */
function doneFrameBase(): PropCanvas {
  const c = new PropCanvas(16, 12);
  c.paste(frame(16, 12, { outline: 'o', light: '3', dark: '1' }), 0, 0);
  return c;
}

/**
 * Done frame, 16x12: a wood frame around a cream certificate (frame shadow on its
 * top and left) with a gold medal on a magenta ribbon and two grey rule lines.
 */
function doneFrame(): Grid {
  const c = doneFrameBase();
  c.rect(2, 2, 12, 8, 'c');
  c.rect(2, 2, 12, 1, 'C');
  c.rect(2, 2, 1, 8, 'C');
  c.set(5, 8, 'R');
  c.set(7, 8, 'R');
  c.set(5, 9, 'r');
  c.set(7, 9, 'r');
  c.paste(['.GG.', 'GWGg', 'GGgg', '.gg.'], 4, 4);
  c.rect(9, 4, 3, 1, 'L');
  c.rect(9, 6, 3, 1, 'L');
  c.rect(9, 8, 2, 1, 'L');
  return c.grid();
}

/** Empty done frame, 16x12: the same wood frame, a dark backing and a glint on the glass. */
function doneFrameEmpty(): Grid {
  const c = doneFrameBase();
  c.rect(2, 2, 12, 8, 'k');
  c.rect(2, 2, 12, 1, 'K');
  c.line(9, 6, 12, 3, 'G');
  c.line(10, 7, 12, 5, 'G');
  return c.grid();
}

/** Done sign, 32x8: a wood plaque with brass screws, a gold trophy and a star either side. */
function doneSign(): Grid {
  const c = new PropCanvas(32, 8);
  c.rect(0, 0, 32, 8, 'o');
  c.rect(1, 1, 30, 6, '2');
  c.rect(1, 1, 30, 1, '3');
  c.rect(1, 1, 1, 6, '3');
  c.rect(30, 2, 1, 5, '1');
  c.rect(2, 6, 29, 1, '1');
  c.set(3, 3, 'G');
  c.set(28, 3, 'G');
  c.paste(['.LGGGGg.', 'GLGGGggG', '.GLGGgg.', '..LGg...', '...Gg...', '..LGGg..'], 12, 1);
  const star = (x: number, y: number): void => {
    c.set(x, y, 'L');
    c.set(x - 1, y, 'G');
    c.set(x + 1, y, 'G');
    c.set(x, y - 1, 'G');
    c.set(x, y + 1, 'g');
  };
  star(7, 4);
  star(24, 4);
  return c.grid();
}

/** Bookcase, 32x32: wood case (lit left/top boards), two shelves, dark back; compartments at y 3, 13, 23. */
function bookcase(): PropCanvas {
  const c = new PropCanvas(32, 32);
  c.rect(0, 0, 32, 32, 'o');
  c.rect(1, 1, 30, 30, '2');
  c.rect(1, 1, 30, 1, '3');
  c.rect(1, 1, 1, 30, '3');
  c.rect(30, 2, 1, 29, '1');
  for (const y of [3, 13, 23]) {
    const h = y === 23 ? 7 : 8;
    c.rect(3, y, 26, h, 'k');
    c.rect(3, y, 26, 1, 'K');
    if (y > 3) {
      c.rect(2, y - 2, 28, 1, '3');
      c.rect(2, y - 1, 28, 1, '1');
    }
  }
  c.rect(1, 30, 30, 1, '1');
  return c;
}

const BOOKS = { A: 'blue1', a: 'blue0', B: 'magenta1', b: 'magenta0', C: 'green1', c: 'green0', D: 'orange1', d: 'orange0' };

/**
 * Shelf of books, 32x32: three compartments of standing books (base spine with a
 * shaded right edge), a stack of lying books, a small robot figure and a bookend gap.
 */
function shelfBooks(): Grid {
  const c = bookcase();
  c.paste(shadeRuns(bookRow(26, 11, 8)), 3, 3);
  c.paste(shadeRuns(bookRow(18, 23, 8)), 3, 13);
  c.paste(shadeRuns(bookRow(14, 37, 7)), 3, 23);
  // Robot figure on the middle shelf: head with screen eyes, antenna, body.
  c.paste(['..r...', '.RRRR.', '.RssR.', '.rrrr.', '..Rr..', '.RRrr.', '.RrRr.'], 22, 14);
  // Lying books on the bottom shelf, the top one lit.
  c.paste(['AAAAAAAAAa', '.CCCCCCCc.', 'DDDDDDDDDd', '.BBBBBBBBb'], 18, 26);
  c.rect(18, 25, 9, 1, 'R');
  c.set(27, 25, 'r');
  c.rect(19, 24, 7, 1, 'k');
  return c.grid();
}

/**
 * Shelf of binders, 32x32: binders (spine label, finger hole, shaded right edge),
 * magazine files with slanted tops and two cardboard archive boxes.
 */
function shelfBinders(): Grid {
  const c = bookcase();
  const r = rng(808);
  const colours = ['A', 'B', 'C', 'D', 'E'];
  const binder = (x: number, y: number, h: number, ch: string): void => {
    c.rect(x, y, 4, h, ch);
    c.rect(x + 3, y, 1, h, ch.toLowerCase());
    c.rect(x + 1, y + 1, 2, 2, 'L');
    c.set(x + 1, y + h - 2, 'k');
    c.set(x + 2, y + h - 2, 'k');
  };
  let prev = '';
  for (let i = 0; i < 6; i++) {
    const choices = colours.filter((ch) => ch !== prev);
    const ch = choices[Math.floor(r() * choices.length)] ?? 'A';
    prev = ch;
    binder(3 + i * 4, 4, 7, ch);
  }
  binder(3, 14, 7, 'E');
  binder(7, 14, 7, 'A');
  // A binder leaning on its neighbour, a stack of paper and a pencil cup.
  for (let j = 0; j < 7; j++) {
    const x = 11 + Math.floor((6 - j) / 2);
    c.rect(x, 14 + j, 3, 1, 'B');
    c.set(x + 3, 14 + j, 'b');
  }
  c.rect(12, 15, 2, 1, 'L');
  for (let y = 17; y < 21; y++) c.rect(16, y, 7, 1, y % 2 === 1 ? 'L' : 'e');
  c.rect(23, 18, 1, 3, 'e');
  c.rect(24, 17, 4, 4, 'E');
  c.rect(27, 17, 1, 4, 'e');
  c.rect(24, 15, 1, 2, 'D');
  c.rect(25, 14, 1, 3, 'A');
  c.rect(26, 15, 1, 2, 'C');
  // Archive boxes: lit top, cream label, hand hole.
  for (const x of [3, 16]) {
    c.rect(x, 24, 12, 6, 'w');
    c.rect(x, 24, 12, 1, 'W');
    c.rect(x + 11, 25, 1, 5, 'x');
    c.rect(x + 3, 26, 5, 2, 'L');
    c.rect(x + 4, 28, 3, 1, 'k');
  }
  return c.grid();
}

/** A 16x24 poster: outline, cream paper border (wider at the bottom), two pins; inside x 2..13, y 2..19. */
function poster(paint: (c: PropCanvas) => void): Grid {
  const c = new PropCanvas(16, 24);
  c.rect(0, 0, 16, 24, 'o');
  c.rect(1, 1, 14, 22, 'p');
  c.rect(1, 21, 14, 2, 'P');
  c.rect(14, 1, 1, 22, 'P');
  paint(c);
  c.set(2, 1, 'X');
  c.set(13, 1, 'X');
  // Lifted lower-right corner shows the paper's back.
  c.set(15, 23, '.');
  c.set(14, 23, 'o');
  c.set(15, 22, 'o');
  c.set(14, 22, 'p');
  return c.grid();
}

/** Map poster: blue sea with wave marks, two green islands with sandy coasts, a dotted route and a pin. */
function posterMap(): Grid {
  return poster((c) => {
    c.rect(2, 2, 12, 18, 'S');
    for (let y = 3; y < 20; y += 3) for (let x = 2 + (y % 2) * 2; x < 14; x += 5) c.set(x, y, 's');
    const blobs: [number, number, number, number][] = [
      [6, 6.5, 3.6, 3.2],
      [10.5, 14, 3.2, 3.6],
      [3.5, 16.5, 1.6, 1.4],
    ];
    const r = rng(41);
    const jitter = Array.from({ length: 24 * 16 }, () => r() * 0.35);
    const field = (x: number, y: number): number =>
      Math.min(...blobs.map(([bx, by, rx, ry]) => ((x - bx) / rx) ** 2 + ((y - by) / ry) ** 2)) + (jitter[y * 16 + x] ?? 0);
    for (let y = 2; y < 20; y++) {
      for (let x = 2; x < 14; x++) {
        const f = field(x, y);
        if (f < 0.9) c.set(x, y, field(x + 1, y + 1) >= 0.9 ? 'g' : 'G');
        else if (f < 1.3) c.set(x, y, 'c');
      }
    }
    for (const [x, y] of [
      [7, 9],
      [7, 11],
      [8, 12],
    ] as const) {
      c.set(x, y, 'r');
    }
    c.rect(10, 13, 2, 2, 'R');
    c.set(10, 13, 'r');
    // Compass mark in the top-right sea.
    c.set(12, 3, 'p');
    c.set(11, 4, 'p');
    c.set(13, 4, 'p');
    c.set(12, 5, 'p');
    c.set(12, 4, 's');
  });
}

/** Rocket poster: starry night with a planet, a cream rocket with a blue window, fins and a flame, smoke puffs. */
function posterRocket(): Grid {
  return poster((c) => {
    c.rect(2, 2, 12, 18, 'k');
    const r = rng(9);
    for (let i = 0; i < 10; i++) c.set(2 + Math.floor(r() * 12), 2 + Math.floor(r() * 12), 'd');
    c.ellipse(12.5, 4, 2.4, 2.4, (x, y, d) => c.set(x, y, d > 0.5 || x + y > 16 ? 'M' : 'm'));
    c.paste(
      [
        '...Ww...',
        '..WWww..',
        '..WWww..',
        '..WbBw..',
        '..WBBw..',
        '..WWww..',
        '.rWWwwR.',
        'rrWWwwRR',
        'r.rrRR.R',
        '...fF...',
        '...Ff...',
        '....f...',
      ],
      4,
      3,
    );
    c.paste(['.v..', 'vVv.', '.vVv', 'vv.v'], 5, 15);
    c.paste(['..v.', '.vVv', 'vvV.'], 9, 16);
  });
}

/** Wave poster: a dusk sky in magenta and orange, a striped setting sun, rolling sea with foam crests. */
function posterWave(): Grid {
  return poster((c) => {
    for (let y = 2; y < 20; y++) {
      for (let x = 2; x < 14; x++) {
        const dith = (x + y) % 2 === 0;
        let ch = 'm';
        if (y >= 6) ch = 'M';
        else if (y === 5 && dith) ch = 'M';
        if (y >= 10) ch = 'O';
        else if (y === 9 && dith) ch = 'O';
        c.set(x, y, ch);
      }
    }
    c.ellipse(7.5, 12, 4.2, 4.2, (x, y) => {
      if (y <= 12) c.set(x, y, y === 10 || y === 12 ? 'Y' : 'y');
    });
    for (let y = 13; y < 20; y++) for (let x = 2; x < 14; x++) c.set(x, y, 'B');
    for (const [y0, phase] of [
      [14, 0],
      [16, 2],
      [18, 1],
    ] as const) {
      for (let x = 2; x < 14; x++) {
        const k = (x + phase) % 4;
        const y = y0 + (k === 0 ? -1 : 0);
        c.set(x, y, k === 0 ? 'p' : 'b');
      }
    }
  });
}

/** Sticky notes, 16x12: four overlapping notes (yellow, pink, green, blue), shaded bottoms, scribble dashes, a pin. */
function stickyNotes(): Grid {
  const c = new PropCanvas(16, 12);
  const note = (x: number, y: number, base: string, shade: string, pin: boolean): void => {
    c.rect(x, y, 6, 5, base);
    c.rect(x, y + 4, 6, 1, shade);
    c.rect(x + 5, y + 1, 1, 4, shade);
    c.rect(x + 1, y + 2, 3, 1, 'k');
    if (pin) c.set(x + 2, y, 'X');
  };
  note(0, 1, 'y', 'Y', true);
  note(5, 0, 'p', 'P', false);
  note(10, 2, 'q', 'Q', true);
  note(3, 6, 'n', 'N', false);
  note(9, 7, 'y', 'Y', true);
  return c.grid();
}

/** Clock, 12x12: wood rim (lit upper left), cream face shaded lower right, four ticks, hands at ten past ten. */
function clock(): Grid {
  const c = new PropCanvas(12, 12);
  c.ellipse(5.5, 5.5, 6, 6, (x, y, d) => {
    if (d > 0.72) c.set(x, y, 'o');
    else if (d > 0.42) c.set(x, y, x + y < 10 ? '3' : '1');
    else c.set(x, y, x + y > 13 ? 'F' : 'f');
  });
  for (const [x, y] of [
    [5, 2],
    [6, 2],
    [5, 9],
    [6, 9],
    [2, 5],
    [2, 6],
    [9, 5],
    [9, 6],
  ] as const) {
    c.set(x, y, 'k');
  }
  c.line(6, 3, 6, 6, 'h');
  c.line(6, 6, 8, 6, 'h');
  c.set(5, 7, 'r');
  c.set(4, 8, 'r');
  return c.grid();
}

/**
 * Neon sign, 32x16: an abstract ringed planet in a magenta tube with a cyan ring
 * (its back half hidden behind the planet), two cyan sparkles and a magenta spark;
 * every tube wears a dithered glow halo on the wall.
 */
function neonSign(): Grid {
  const c = new PropCanvas(32, 16);
  const cx = 15.5;
  const cy = 7.5;
  c.ellipse(cx, cy, 5.2, 5.2, (x, y, d) => {
    if (d > 0.62) c.set(x, y, 'M');
  });
  for (let i = 0; i < 400; i++) {
    const t = (i / 400) * Math.PI * 2;
    const ex = 13 * Math.cos(t);
    const x = Math.round(cx + ex);
    const y = Math.round(cy + 3.2 * Math.sin(t) - 0.28 * ex);
    const behind = Math.sin(t) < 0 && (x - cx) ** 2 + (y - cy) ** 2 < 5.6 ** 2;
    if (!behind) c.set(x, y, 'C');
  }
  const sparkle = (x: number, y: number, ch: string): void => {
    c.set(x, y, ch);
    c.set(x - 1, y, ch);
    c.set(x + 1, y, ch);
    c.set(x, y - 1, ch);
    c.set(x, y + 1, ch);
  };
  sparkle(4, 3, 'C');
  sparkle(27, 13, 'C');
  c.set(27, 2, 'M');
  c.set(5, 12, 'M');
  // Glow: halo next to each tube, in the tube's darker tone, dithered on the diagonal ring.
  const hits: [number, number, string][] = [];
  for (let y = 0; y < 16; y++) {
    for (let x = 0; x < 32; x++) {
      if (c.get(x, y) !== '.') continue;
      const orth = [c.get(x - 1, y), c.get(x + 1, y), c.get(x, y - 1), c.get(x, y + 1)];
      const diag = [c.get(x - 1, y - 1), c.get(x + 1, y - 1), c.get(x - 1, y + 1), c.get(x + 1, y + 1)];
      const src = orth.find((n) => n === 'M' || n === 'C') ?? ((x + y) % 2 === 0 ? diag.find((n) => n === 'M' || n === 'C') : undefined);
      if (src !== undefined) hits.push([x, y, src === 'M' ? 'm' : 'c']);
    }
  }
  for (const [x, y, ch] of hits) c.set(x, y, ch);
  return c.grid();
}

/** Fairy lights, 64x8: a dark wire in two swags with glowing bulbs (warm, magenta, cyan, green) hanging from it. */
function fairyLights(): Grid {
  const c = new PropCanvas(64, 8);
  const wireY = (x: number): number => {
    const half = 16;
    const centre = x < 32 ? 15.5 : 47.5;
    const u = (x - centre) / half;
    return 1 + Math.round(4 * (1 - u * u));
  };
  for (let x = 0; x < 64; x++) {
    c.set(x, wireY(x), 'w');
    const next = wireY(x + 1);
    if (x < 63 && Math.abs(next - wireY(x)) > 1) c.set(x, Math.round((next + wireY(x)) / 2), 'w');
  }
  c.set(0, 0, 'w');
  c.set(63, 0, 'w');
  c.set(31, 0, 'w');
  c.set(32, 0, 'w');
  const bulbs = [
    ['Y', 'y'],
    ['M', 'm'],
    ['C', 'c'],
    ['Y', 'y'],
    ['G', 'g'],
  ] as const;
  let i = 0;
  for (let x = 3; x < 62; x += 5) {
    const [core, glow] = bulbs[i % bulbs.length] ?? bulbs[0];
    const y = wireY(x);
    c.set(x, y + 1, core);
    c.set(x, y + 2, glow);
    i++;
  }
  return c.grid();
}

/** Hanging plant, 16x24: hook and three cords, a terracotta pot (lit rim), leaves on top and trailing vines. */
function plantHanging(): Grid {
  const c = new PropCanvas(16, 24);
  // Leaves above the rim and vines below, outlined in the leaf shade.
  const leaf = (x: number, y: number): void => {
    c.set(x, y, 'L');
    c.set(x + 1, y, 'L');
    c.set(x, y + 1, 'l');
  };
  for (const [x, y] of [
    [4, 7],
    [6, 5],
    [8, 6],
    [10, 5],
    [11, 7],
    [2, 8],
    [13, 8],
    [7, 7],
  ] as const) {
    leaf(x, y);
  }
  const vines: [number, number, number][] = [
    [3, 12, 9],
    [6, 14, 6],
    [11, 13, 4],
    [13, 12, 4],
  ];
  for (const [vx, vy, len] of vines) {
    for (let j = 0; j < len; j++) {
      const x = vx + (Math.floor(j / 3) % 2 === 0 ? 0 : 1);
      c.set(x, vy + j, 'l');
      if (j % 2 === 1) c.set(j % 4 === 1 ? x - 1 : x + 1, vy + j, 'L');
    }
  }
  c.outline('l', (n) => n === 'L');
  // Cords and hook.
  c.rect(7, 0, 2, 1, 'h');
  c.line(7, 1, 3, 8, 'r');
  c.line(8, 1, 12, 8, 'r');
  c.line(7, 1, 7, 8, 'r');
  // Pot: rim (lit top), tapering body, shade on the right.
  c.rect(2, 9, 12, 2, 'T');
  c.rect(2, 10, 12, 1, 't');
  c.rect(3, 11, 10, 3, 'T');
  c.rect(4, 14, 8, 1, 'T');
  c.rect(10, 11, 3, 3, 't');
  c.rect(10, 14, 2, 1, 't');
  c.rect(3, 11, 1, 3, 'U');
  c.outline('o', (n) => n === 'T' || n === 't' || n === 'U');
  return c.grid();
}

/** Cables, 16x6: a power strip with sockets and a lit switch, two cables curling away to the left. */
function cables(): Grid {
  const c = new PropCanvas(16, 6);
  c.line(0, 1, 3, 2, 'c');
  c.line(3, 2, 6, 2, 'c');
  c.line(6, 2, 9, 4, 'c');
  c.line(0, 4, 2, 5, 'b');
  c.line(2, 5, 6, 5, 'b');
  c.line(6, 5, 8, 4, 'b');
  c.set(1, 1, 'C');
  c.set(4, 2, 'C');
  c.rect(8, 2, 8, 4, 'o');
  c.rect(9, 3, 6, 1, 'W');
  c.rect(9, 4, 6, 1, 'w');
  c.set(10, 3, 'k');
  c.set(12, 3, 'k');
  c.set(14, 3, 'r');
  return c.grid();
}

const WOOD = { o: 'wood0', '1': 'wood1', '2': 'wood2', '3': 'wood3' };
const MARKERS = { k: 'night1', b: 'blue1', m: 'magenta1', n: 'green1', r: 'orange1' };
const NOTES = { y: 'lamp1', Y: 'lamp0', p: 'magenta1', P: 'magenta0', q: 'blue1', Q: 'blue0', n: 'green1', N: 'green0' };
const POSTER = { o: 'night0', p: 'lamp2', P: 'night4', X: 'orange1' };

/** The wall sprites of the `props` family. */
export const SPRITES: SpriteDef[] = [
  {
    id: 'whiteboard',
    w: 96,
    h: 48,
    grid: whiteboard(),
    key: {
      ...NOTES,
      ...MARKERS,
      o: 'night0',
      F: 'night4',
      f: 'night3',
      g: 'night2',
      w: 'lamp2',
      v: 'night4',
      e: 'wood3',
      E: 'wood2',
    },
  },
  {
    id: 'done-frame',
    w: 16,
    h: 12,
    grid: doneFrame(),
    key: { ...WOOD, c: 'lamp2', C: 'night4', W: 'lamp2', G: 'lamp1', g: 'lamp0', L: 'night3', R: 'magenta1', r: 'magenta0' },
  },
  { id: 'done-frame-empty', w: 16, h: 12, grid: doneFrameEmpty(), key: { ...WOOD, k: 'night1', K: 'night0', G: 'night3' } },
  { id: 'done-sign', w: 32, h: 8, grid: doneSign(), key: { ...WOOD, L: 'lamp2', G: 'lamp1', g: 'lamp0' } },
  {
    id: 'shelf-books',
    w: 32,
    h: 32,
    grid: shelfBooks(),
    key: { ...WOOD, ...BOOKS, k: 'night1', K: 'night0', R: 'night4', r: 'night3', s: 'screen1' },
  },
  {
    id: 'shelf-binders',
    w: 32,
    h: 32,
    grid: shelfBinders(),
    key: { ...WOOD, ...BOOKS, E: 'night4', e: 'night3', L: 'lamp2', k: 'night0', K: 'night0', w: 'wood3', W: 'lamp1', x: 'wood2' },
  },
  {
    id: 'poster-map',
    w: 16,
    h: 24,
    grid: posterMap(),
    key: { ...POSTER, S: 'blue0', s: 'blue1', G: 'green1', g: 'green0', c: 'lamp1', r: 'orange1', R: 'magenta1' },
  },
  {
    id: 'poster-rocket',
    w: 16,
    h: 24,
    grid: posterRocket(),
    key: {
      ...POSTER,
      k: 'night1',
      d: 'night4',
      m: 'magenta1',
      M: 'magenta0',
      W: 'lamp2',
      w: 'night4',
      b: 'blue1',
      B: 'blue0',
      r: 'orange1',
      R: 'orange0',
      f: 'lamp1',
      F: 'lamp0',
      v: 'night3',
      V: 'night2',
    },
  },
  {
    id: 'poster-wave',
    w: 16,
    h: 24,
    grid: posterWave(),
    key: { ...POSTER, m: 'magenta0', M: 'magenta1', O: 'orange1', y: 'lamp1', Y: 'lamp0', B: 'blue0', b: 'blue1' },
  },
  { id: 'sticky-notes', w: 16, h: 12, grid: stickyNotes(), key: { ...NOTES, k: 'night2', X: 'orange1' } },
  { id: 'clock', w: 12, h: 12, grid: clock(), key: { ...WOOD, f: 'lamp2', F: 'night4', k: 'night2', h: 'night0', r: 'orange1' } },
  {
    id: 'neon-sign',
    w: 32,
    h: 16,
    grid: neonSign(),
    key: { M: 'neon0', m: 'magenta0', C: 'neon1', c: 'blue1' },
  },
  {
    id: 'fairy-lights',
    w: 64,
    h: 8,
    grid: fairyLights(),
    key: { w: 'night0', Y: 'lamp2', y: 'lamp1', M: 'neon0', m: 'magenta1', C: 'neon1', c: 'screen0', G: 'screen1', g: 'green1' },
  },
  {
    id: 'plant-hanging',
    w: 16,
    h: 24,
    grid: plantHanging(),
    key: { L: 'green1', l: 'green0', h: 'night4', r: 'wood3', T: 'orange1', t: 'orange0', U: 'lamp0', o: 'wood0' },
  },
  {
    id: 'cables',
    w: 16,
    h: 6,
    grid: cables(),
    key: { c: 'night0', C: 'night2', b: 'blue0', o: 'night0', W: 'night4', w: 'night3', k: 'night1', r: 'orange1' },
  },
];
