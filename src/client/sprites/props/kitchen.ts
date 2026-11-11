// Props: kitchen sprites (plan step 8.2) — counter, coffee machine with a lit
// indicator, couch, rug, plants, fridge and clutter. Drawn on the char canvas of
// the wall props. Light from the upper left: lit top/left edges, shaded
// bottom/right, outlines in each material's darkest tone. Original art (scope
// P-6). DOM-free.
import type { Grid, SpriteDef } from '../types.js';
import { PropCanvas } from './wall.js';

/**
 * Counter, 64x32: a butcher-block worktop seen from above (grain, lit front lip),
 * four sage cabinets each with a drawer and a panelled door, brass handles, a
 * towel over one door and a dark kick plate. The coffee machine, kettle and mug
 * stand on rows 2-4 of the worktop.
 */
function counter(): Grid {
  const W = 64;
  const c = new PropCanvas(W, 32);
  c.rect(0, 0, W, 32, 'o');
  // Worktop.
  c.rect(1, 1, W - 2, 4, 'T');
  c.rect(1, 1, W - 2, 1, 'L');
  for (const [x, y, w] of [
    [4, 2, 9],
    [20, 3, 12],
    [38, 2, 7],
    [50, 3, 10],
    [12, 4, 6],
  ] as const) {
    c.rect(x, y, w, 1, 't');
  }
  c.rect(1, 5, W - 2, 1, 'L');
  c.rect(1, 6, W - 2, 1, 't');
  // Cabinets: shadow under the lip, then four units.
  c.rect(1, 8, W - 2, 21, 'D');
  c.rect(1, 8, W - 2, 1, 'd');
  for (const x0 of [1, 17, 33, 48]) {
    const w = 15;
    c.rect(x0 + w, 8, 1, 21, 'o');
    // Drawer (rows 9-12) and door (rows 14-27): lit top/left, shade bottom/right.
    for (const [y, h] of [
      [9, 4],
      [14, 14],
    ] as const) {
      c.rect(x0 + 1, y, w - 2, h, 'D');
      c.rect(x0 + 1, y, w - 2, 1, 'H');
      c.rect(x0 + 1, y, 1, h, 'H');
      c.rect(x0 + 1, y + h - 1, w - 2, 1, 'd');
      c.rect(x0 + w - 2, y, 1, h, 'd');
    }
    // Recessed door panel: shaded top/left inner edge, lit bottom/right inner edge.
    c.rect(x0 + 3, 16, w - 6, 10, 'H');
    c.rect(x0 + 3, 16, w - 7, 9, 'd');
    c.rect(x0 + 4, 17, w - 8, 8, 'D');
    c.rect(x0 + 3, 13, w - 2, 1, 'o');
    // Handles.
    c.rect(x0 + Math.floor(w / 2) - 1, 10, 3, 1, 'G');
    c.rect(x0 + Math.floor(w / 2) - 1, 11, 3, 1, 'g');
    const hx = x0 % 2 === 1 && x0 < 32 ? x0 + w - 4 : x0 + 2;
    c.rect(hx, 19, 1, 3, 'G');
    c.set(hx, 21, 'g');
  }
  c.rect(1, 13, W - 2, 1, 'o');
  // Towel over the third door.
  c.rect(38, 12, 5, 9, 'P');
  c.rect(38, 12, 5, 1, 'p');
  c.rect(42, 13, 1, 8, 'p');
  c.rect(38, 16, 4, 1, 'Q');
  c.rect(38, 18, 4, 1, 'Q');
  c.rect(38, 21, 5, 1, 'o');
  // Kick plate.
  c.rect(1, 29, W - 2, 2, 'k');
  c.rect(1, 29, W - 2, 1, 'o');
  return c.grid();
}

/**
 * Coffee machine, 16x24: a retro orange espresso machine with a glass bean hopper,
 * a lit green-and-gold indicator, a chrome group head and portafilter, a cream cup
 * under the spout and a grilled drip tray.
 */
function coffeeMachine(): Grid {
  const c = new PropCanvas(16, 24);
  // Hopper: lid, glass with beans.
  c.rect(5, 0, 6, 1, 's');
  c.rect(4, 1, 8, 1, 'S');
  c.rect(5, 2, 6, 4, 'g');
  c.rect(5, 2, 1, 4, 'G');
  c.rect(6, 3, 4, 3, 'n');
  c.set(7, 4, 'N');
  c.set(9, 3, 'N');
  c.set(6, 5, 'N');
  // Body.
  c.rect(2, 6, 12, 16, 'B');
  c.rect(2, 6, 12, 1, 'H');
  c.rect(2, 6, 1, 16, 'H');
  c.rect(12, 7, 2, 15, 'b');
  // Indicator panel: dark strip with the lit lamp and a green status pixel.
  c.rect(4, 8, 8, 3, 'k');
  c.set(10, 9, 'I');
  c.set(9, 9, 'i');
  c.set(10, 8, 'i');
  c.set(5, 9, 'e');
  c.set(6, 9, 'E');
  // Recess with group head, portafilter, spout and cup.
  c.rect(3, 12, 10, 9, 'k');
  c.rect(5, 12, 6, 2, 's');
  c.rect(5, 12, 6, 1, 'S');
  c.rect(1, 14, 6, 1, 'k');
  c.set(1, 14, 'K');
  c.rect(7, 14, 2, 1, 's');
  c.set(7, 15, 'N');
  c.set(8, 16, 'N');
  c.rect(5, 17, 6, 4, 'W');
  c.rect(10, 17, 1, 4, 'w');
  c.rect(5, 17, 5, 1, 'N');
  c.set(11, 18, 'W');
  c.set(11, 19, 'w');
  // Drip tray and base.
  c.rect(2, 21, 12, 2, 's');
  c.rect(2, 21, 12, 1, 'S');
  for (let x = 3; x < 13; x += 2) c.set(x, 22, 'k');
  c.outline('o');
  return c.grid();
}

/**
 * Couch, 64x32: a rust two-seater — rounded back with two cushions, rolled arms,
 * two seat cushions with lit tops, a skirt, wooden feet, a blue throw pillow and a
 * dithered shadow on the floor. Seats at x 16 and x 48 (layout spots couch-1/2).
 */
function couch(): Grid {
  const W = 64;
  const c = new PropCanvas(W, 32);
  // Floor shadow.
  for (let x = 2; x < W - 2; x++) {
    if (x % 2 === 0) c.set(x, 30, 'S');
    c.set(x, 29, 'S');
  }
  // Back.
  c.rect(6, 1, W - 12, 15, 'B');
  for (const x0 of [7, 32]) {
    c.rect(x0, 2, 25, 12, 'B');
    c.rect(x0, 2, 25, 1, 'H');
    c.rect(x0, 2, 1, 11, 'H');
    c.rect(x0 + 23, 3, 2, 11, 'b');
    c.rect(x0, 12, 25, 2, 'b');
    c.rect(x0 + 24, 2, 1, 12, 'o');
  }
  // Seat cushions.
  for (const x0 of [7, 32]) {
    c.rect(x0, 14, 25, 7, 'B');
    c.rect(x0, 14, 25, 2, 'H');
    c.rect(x0, 19, 25, 2, 'b');
    c.rect(x0 + 24, 14, 1, 7, 'o');
  }
  // Skirt.
  c.rect(6, 21, W - 12, 7, 'b');
  c.rect(6, 21, W - 12, 1, 'o');
  c.rect(6, 22, W - 12, 1, 'B');
  // Arms: rolled tops, lit left arm face, shaded right arm face.
  for (const [x0, face] of [
    [0, 'B'],
    [W - 8, 'b'],
  ] as const) {
    c.rect(x0, 7, 8, 21, face);
    c.rect(x0, 7, 8, 3, 'H');
    c.rect(x0, 9, 8, 1, 'B');
    c.rect(x0 + 1, 10, 6, 1, 'b');
    c.rect(x0, 11, 1, 17, x0 === 0 ? 'H' : 'b');
  }
  c.set(0, 7, '.');
  c.set(7, 7, '.');
  c.set(W - 8, 7, '.');
  c.set(W - 1, 7, '.');
  c.set(6, 1, '.');
  c.set(W - 7, 1, '.');
  // Throw pillow in the left corner.
  c.paste(['.PPPPP.', 'PQPPPPp', 'PPPPPpp', 'PPPPppp', '.Pppppp', '..pp.p.'], 8, 9);
  // Feet.
  for (const x of [2, 12, W - 14, W - 4]) {
    c.rect(x, 28, 2, 2, 'f');
    c.set(x + 1, 29, 'F');
  }
  c.outline('o', (n) => n !== 'S');
  return c.grid();
}

/**
 * Kitchen rug, 64x32: a cream fringe on the short ends, a plum border with a gold
 * line, a deep blue field with a diamond lattice and a central diamond medallion.
 */
function rugKitchen(): Grid {
  const W = 64;
  const H = 32;
  const c = new PropCanvas(W, H);
  for (let y = 1; y < H - 1; y++) {
    if (y % 2 === 1) {
      c.set(0, y, 'f');
      c.set(W - 1, y, 'f');
    }
    c.set(1, y, 'F');
    c.set(W - 2, y, 'F');
  }
  c.rect(2, 0, W - 4, H, 'R');
  c.rect(2, H - 1, W - 4, 1, 'r');
  c.rect(4, 2, W - 8, H - 4, 'Y');
  c.rect(5, 3, W - 10, H - 6, 'B');
  const cx = 31.5;
  const cy = 15.5;
  for (let y = 3; y < H - 3; y++) {
    for (let x = 5; x < W - 5; x++) {
      const m = Math.abs(x - cx) / 2 + Math.abs(y - cy);
      if (m < 2) c.set(x, y, 'Y');
      else if (m < 4) c.set(x, y, 'M');
      else if (m < 5) c.set(x, y, 'Y');
      else {
        const lx = (((x - 5) % 8) + 8) % 8;
        const ly = (((y - 3) % 8) + 8) % 8;
        if (Math.abs(lx - 3.5) + Math.abs(ly - 3.5) <= 2) c.set(x, y, (x + y) % 2 === 0 ? 'b' : 'B');
      }
    }
  }
  // Worn, slightly shaded lower and right borders.
  c.rect(5, H - 4, W - 10, 1, 'r');
  for (let x = 2; x < W - 2; x += 4) c.set(x, 1, 'Y');
  return c.grid();
}

/** Terracotta pot (rim with a lit top, tapering body shaded right) with its top-left rim at (x, y), rim width w. */
function pot(c: PropCanvas, x: number, y: number, w: number, h: number): void {
  c.rect(x, y, w, 2, 'T');
  c.rect(x, y + 1, w, 1, 't');
  c.rect(x + 1, y + 2, w - 2, h - 2, 'T');
  c.rect(x + 2, y + h - 1, w - 4, 1, 'T');
  c.rect(x + w - 4, y + 2, 3, h - 3, 't');
  c.rect(x + w - 4, y + h - 1, 2, 1, 't');
  c.rect(x + 1, y + 2, 1, h - 3, 'U');
  c.set(x + 1, y, 'U');
}

/** Small plant, 16x16: a snake plant with upright pointed leaves (lit left half) in a terracotta pot. */
function plantSmall(): Grid {
  const c = new PropCanvas(16, 16);
  for (const [x, top] of [
    [4, 4],
    [6, 1],
    [8, 3],
    [10, 2],
  ] as const) {
    c.set(x, top, 'L');
    for (let y = top + 1; y < 11; y++) {
      c.set(x, y, 'L');
      c.set(x + 1, y, 'l');
    }
    c.set(x, top + 3, 'h');
  }
  c.rect(5, 6, 1, 1, 'l');
  pot(c, 3, 10, 10, 6);
  c.outline('o', (n) => n === 'T' || n === 't' || n === 'U');
  c.outline('O', (n) => n === 'L' || n === 'l' || n === 'h');
  return c.grid();
}

/** Floor plant, 16x28: a tall leafy plant (broad leaves, lit upper left, stems) in a large blue glazed pot. */
function plantFloor(): Grid {
  const c = new PropCanvas(16, 28);
  // Leaves back to front, each with its own green0 rim so overlapping leaves stay apart,
  // a lit upper-left half and a midrib from the stem side.
  const leaves: [number, number, number, number][] = [
    [8, 3.5, 2.6, 3.4],
    [3.5, 8, 3.4, 2.4],
    [12.5, 7.5, 3.4, 2.4],
    [8.5, 10.5, 3, 2.8],
    [3.5, 14.5, 3.2, 2.2],
    [12.5, 15, 3.2, 2.2],
  ];
  for (const [lx, ly] of leaves) c.line(8, 19, Math.round(lx), Math.round(ly + 1), 'l');
  for (const [lx, ly, rx, ry] of leaves) {
    c.ellipse(lx, ly, rx, ry, (x, y, d) => {
      const lit = x - lx + (y - ly) < 0;
      c.set(x, y, d > 0.62 ? 'l' : lit ? 'L' : 'M');
    });
    c.line(Math.round(lx), Math.round(ly), 8, Math.round(ly + ry - 0.5), 'l');
    c.set(Math.round(lx - rx / 2), Math.round(ly - ry / 2), 'h');
  }
  c.outline('O', (n) => n === 'L' || n === 'l' || n === 'h' || n === 'M');
  // Pot: lit rim, glazed body shaded right, a highlight streak.
  c.rect(2, 19, 12, 2, 'Q');
  c.rect(2, 20, 12, 1, 'P');
  c.rect(3, 21, 10, 6, 'P');
  c.rect(4, 27, 8, 1, 'P');
  c.rect(10, 21, 3, 6, 'p');
  c.rect(10, 27, 2, 1, 'p');
  c.rect(4, 22, 1, 3, 'Q');
  c.outline('o', (n) => n === 'P' || n === 'p' || n === 'Q');
  return c.grid();
}

/**
 * Fridge, 24x44: a cream retro fridge with rounded top corners, freezer and main
 * door (lit left edge, shaded right side), chrome handles, a photo, a note and
 * magnets on the door, a kick plate and feet.
 */
function fridge(): Grid {
  const c = new PropCanvas(24, 44);
  c.rect(0, 0, 24, 42, 'o');
  c.rect(1, 1, 22, 40, 'W');
  c.rect(18, 1, 4, 40, 'w');
  c.rect(21, 2, 1, 39, 'v');
  c.rect(1, 1, 22, 1, 'W');
  c.set(0, 0, '.');
  c.set(23, 0, '.');
  c.set(1, 1, 'o');
  c.set(22, 1, 'o');
  // Door gap and its shadow.
  c.rect(1, 13, 22, 1, 'o');
  c.rect(1, 14, 22, 1, 'w');
  // Handles: chrome bars on the left of each door.
  for (const [y, h] of [
    [6, 5],
    [17, 9],
  ] as const) {
    c.rect(3, y, 2, h, 'h');
    c.rect(3, y, 1, h, 'H');
    c.set(4, y + h, 'v');
  }
  // Photo with a little hill and sky, a note, magnets.
  c.rect(9, 18, 7, 6, 'k');
  c.rect(10, 19, 5, 2, 'b');
  c.rect(10, 21, 5, 2, 'n');
  c.set(13, 19, 'y');
  c.set(12, 18, 'm');
  c.rect(10, 27, 5, 5, 'y');
  c.rect(10, 31, 5, 1, 'Y');
  c.rect(11, 29, 3, 1, 'Y');
  c.set(12, 27, 'r');
  c.rect(8, 35, 2, 2, 'm');
  c.rect(14, 34, 2, 2, 'b');
  c.rect(9, 8, 2, 2, 'r');
  c.rect(14, 6, 3, 3, 'n');
  c.set(14, 6, 'N');
  // Kick plate and feet.
  c.rect(1, 39, 22, 2, 'k');
  c.rect(1, 39, 22, 1, 'K');
  c.rect(2, 42, 3, 1, 'o');
  c.rect(19, 42, 3, 1, 'o');
  for (let x = 1; x < 23; x++) if (x % 2 === 0) c.set(x, 43, 'S');
  return c.grid();
}

/** Boxes, 24x16: three stacked cardboard boxes (lit top face, shaded right), packing tape and a cream label. */
function boxes(): Grid {
  const c = new PropCanvas(24, 16);
  const box = (x: number, y: number, w: number, h: number, top: number): void => {
    c.rect(x, y, w, h, 'o');
    c.rect(x + 1, y + 1, w - 2, top, 'T');
    c.rect(x + 1, y + 1 + top, w - 2, h - 2 - top, 'B');
    c.rect(x + 1, y + top, w - 2, 1, 'o');
    c.rect(x + w - 3, y + 1 + top, 2, h - 2 - top, 'b');
    const mid = x + Math.floor(w / 2);
    c.rect(mid, y + 1, 1, top, 'L');
    c.rect(mid, y + 1 + top, 1, 2, 'l');
  };
  box(13, 7, 11, 9, 2);
  box(0, 5, 14, 11, 3);
  box(2, 0, 9, 6, 2);
  c.rect(3, 11, 4, 2, 'L');
  c.rect(3, 12, 4, 1, 'l');
  return c.grid();
}

/** Bin, 12x12: a grey bin with a lit rim, ribbed body shaded right, and crumpled paper sticking out. */
function bin(): Grid {
  const c = new PropCanvas(12, 12);
  c.rect(2, 0, 3, 2, 'p');
  c.set(4, 1, 'P');
  c.rect(6, 1, 2, 1, 'p');
  c.rect(0, 2, 12, 2, 'r');
  c.rect(0, 2, 12, 1, 'R');
  c.rect(1, 4, 10, 7, 'B');
  c.rect(1, 4, 10, 1, 'v');
  c.rect(8, 5, 3, 6, 'b');
  for (const x of [3, 6]) c.rect(x, 5, 1, 5, 'R');
  c.rect(2, 11, 8, 1, 'B');
  c.outline('o');
  return c.grid();
}

/** Kettle, 10x10: a blue electric kettle with a lit left side, a spout, a loop handle and a dark base with a glowing switch. */
function kettle(): Grid {
  const c = new PropCanvas(10, 10);
  c.rect(3, 1, 3, 1, 'k');
  c.rect(2, 2, 5, 6, 'B');
  c.rect(2, 2, 1, 6, 'H');
  c.rect(6, 3, 1, 5, 'b');
  c.rect(1, 3, 1, 2, 'B');
  c.set(0, 3, 'B');
  c.rect(7, 2, 2, 1, 'k');
  c.rect(8, 3, 1, 4, 'k');
  c.rect(1, 8, 7, 1, 'K');
  c.set(6, 8, 'I');
  c.outline('o', (n) => n !== 'k');
  return c.grid();
}

const ORANGE = { o: 'wood0', H: 'lamp0', B: 'orange1', b: 'orange0' };
const POT = { T: 'orange1', t: 'orange0', U: 'lamp0', o: 'wood0' };
const LEAVES = { L: 'green1', M: 'green1', l: 'green0', h: 'screen1', O: 'night1' };

/** The kitchen sprites of the `props` family. */
export const SPRITES: SpriteDef[] = [
  {
    id: 'counter',
    w: 64,
    h: 32,
    grid: counter(),
    key: {
      o: 'wood0',
      L: 'wood3',
      T: 'wood2',
      t: 'wood1',
      H: 'screen1',
      D: 'green1',
      d: 'green0',
      G: 'lamp1',
      g: 'lamp0',
      P: 'magenta1',
      p: 'magenta0',
      Q: 'lamp2',
      k: 'night1',
    },
  },
  {
    id: 'coffee-machine',
    w: 16,
    h: 24,
    grid: coffeeMachine(),
    key: {
      ...ORANGE,
      s: 'night3',
      S: 'night4',
      g: 'night3',
      G: 'night4',
      n: 'wood1',
      N: 'wood0',
      k: 'night1',
      K: 'night0',
      I: 'lamp2',
      i: 'lamp1',
      e: 'screen1',
      E: 'green0',
      W: 'lamp2',
      w: 'night4',
    },
  },
  { id: 'couch', w: 64, h: 32, grid: couch(), key: { ...ORANGE, P: 'blue1', p: 'blue0', Q: 'night4', f: 'wood1', F: 'wood0', S: 'night0' } },
  {
    id: 'rug-kitchen',
    w: 64,
    h: 32,
    grid: rugKitchen(),
    key: { f: 'night4', F: 'lamp2', R: 'magenta0', r: 'night1', Y: 'lamp0', B: 'blue0', b: 'blue1', M: 'magenta1' },
  },
  { id: 'plant-small', w: 16, h: 16, grid: plantSmall(), key: { ...POT, ...LEAVES } },
  {
    id: 'plant-floor',
    w: 16,
    h: 28,
    grid: plantFloor(),
    key: { ...LEAVES, P: 'blue1', p: 'blue0', Q: 'night4', o: 'night0' },
  },
  {
    id: 'fridge',
    w: 24,
    h: 44,
    grid: fridge(),
    key: {
      o: 'night1',
      W: 'lamp2',
      w: 'night4',
      v: 'night3',
      H: 'lamp2',
      h: 'night3',
      k: 'night1',
      K: 'night2',
      b: 'blue1',
      n: 'green1',
      N: 'green0',
      y: 'lamp1',
      Y: 'lamp0',
      m: 'magenta1',
      r: 'orange1',
      S: 'night0',
    },
  },
  {
    id: 'boxes',
    w: 24,
    h: 16,
    grid: boxes(),
    key: { o: 'wood0', T: 'wood3', B: 'wood2', b: 'wood1', L: 'lamp2', l: 'night4' },
  },
  {
    id: 'bin',
    w: 12,
    h: 12,
    grid: bin(),
    key: { o: 'night0', p: 'lamp2', P: 'night4', R: 'night4', r: 'night3', B: 'night3', b: 'night2', v: 'night2' },
  },
  {
    id: 'kettle',
    w: 10,
    h: 10,
    grid: kettle(),
    key: { o: 'night0', B: 'blue1', b: 'blue0', H: 'night4', k: 'night1', K: 'night2', I: 'lamp1' },
  },
];
