// Props: furniture sprites (plan step 7.1) — the CTO's office (big desk, banker's
// lamp, leather chair, visitor chair, tall plant, rug) and the desk kit of every
// desk spot (desk, monitor, desk lamp, chair, stool, keyboard, mug, papers).
// Characters sit behind their desk facing the viewer (plan P-3/P-4): a desk is a
// top surface over a full-height front panel that hides the lower body; the
// monitor stands beside them, turned towards them, so we see its casing side and
// the glowing edge of its screen. Light from the upper left: top/left edges lit,
// bottom/right edges shaded; outlines are the darkest tone of each ramp. Drawn on
// a small char canvas, one readable call per element. DOM-free.
import { grid, rng } from '../kit.js';
import type { Grid, SpriteDef } from '../types.js';

/** A mutable w x h char canvas, transparent (`.`) at start. */
class Canvas {
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

  /** Outlines the rectangle [x, x+w) x [y, y+h) with `ch` (1 px ring). */
  ring(x: number, y: number, w: number, h: number, ch: string): void {
    this.rect(x, y, w, 1, ch);
    this.rect(x, y + h - 1, w, 1, ch);
    this.rect(x, y, 1, h, ch);
    this.rect(x + w - 1, y, 1, h, ch);
  }

  /** Every opaque pixel that touches a transparent one (4-neighbour) becomes `ch`: a sprite outline. */
  outline(ch: string): void {
    const edge: [number, number][] = [];
    for (let y = 0; y < this.h; y++) {
      for (let x = 0; x < this.w; x++) {
        if (this.get(x, y) === '.') continue;
        const open = [
          [x - 1, y],
          [x + 1, y],
          [x, y - 1],
          [x, y + 1],
        ].some(([i = 0, j = 0]) => this.get(i, j) === '.');
        if (open) edge.push([x, y]);
      }
    }
    for (const [x, y] of edge) this.set(x, y, ch);
  }

  /** The canvas as a grid. */
  grid(): Grid {
    return this.px.map((row) => row.join(''));
  }
}

/** A grid mirrored left-right (the monitor turned the other way). */
function mirror(g: Grid): Grid {
  return g.map((row) => [...row].reverse().join(''));
}

/**
 * A raised drawer face [x, x+w) x [y, y+h): lit top/left bevel, shaded bottom/right,
 * a brass pull centred two rows down (lit left pixel, dark shadow under it).
 */
function drawer(c: Canvas, x: number, y: number, w: number, h: number): void {
  c.rect(x, y, w, h, '2');
  c.rect(x, y, w, 1, '3');
  c.rect(x, y, 1, h, '3');
  c.rect(x, y + h - 1, w, 1, '1');
  c.rect(x + w - 1, y + 1, 1, h - 1, '1');
  const px = x + Math.floor(w / 2) - 2;
  const py = y + Math.floor(h / 2) - 1;
  c.rect(px, py, 4, 1, 'k');
  c.set(px, py, 'K');
  c.rect(px + 1, py + 1, 3, 1, 'o');
}

/**
 * Wood top surface [1, w-1) x [1, 1+depth): body with broken grain lines, a lit
 * back/left edge, then the front lip (lit nosing, shaded face, shadow line under it).
 */
function deskTop(c: Canvas, depth: number, seed: number, tones = { body: '2', lit: '3', grain: '1' }): void {
  const r = rng(seed);
  c.rect(1, 1, c.w - 2, depth, tones.body);
  for (let y = 3; y < depth; y += 3) {
    let x = 2 + Math.floor(r() * 6);
    while (x < c.w - 3) {
      const len = 4 + Math.floor(r() * 9);
      c.rect(x, y, Math.min(len, c.w - 2 - x), 1, tones.grain);
      x += len + 3 + Math.floor(r() * 8);
    }
  }
  c.rect(1, 1, c.w - 2, 1, tones.lit);
  c.rect(1, 1, 1, depth, tones.lit);
  // Nosing: the lit front edge of the top, its shaded face, the shadow under the overhang.
  c.rect(1, 1 + depth, c.w - 2, 1, tones.lit);
  c.rect(1, 2 + depth, c.w - 2, 1, '1');
  c.rect(1, 3 + depth, c.w - 2, 1, 'o');
}

/**
 * CTO desk, 64x32: a big wooden top (10 rows deep, room for the monitor, lamp and
 * desk items) over a front with two drawer pedestals (3 drawers each, brass pulls)
 * and a recessed modesty panel between them, on a dark plinth.
 */
function deskCto(): Grid {
  const c = new Canvas(64, 32);
  c.rect(0, 0, 64, 32, 'o');
  deskTop(c, 9, 7);
  // Front panel: rows 13-29, body in the shaded tone.
  c.rect(1, 13, 62, 17, '1');
  for (const px of [2, 44]) {
    for (const py of [13, 19, 25]) drawer(c, px, py, 18, 5);
  }
  // Pedestal sides: a dark joint between pedestals and the modesty panel.
  c.rect(20, 13, 1, 17, 'o');
  c.rect(43, 13, 1, 17, 'o');
  // Modesty panel: recessed (shadow at its top/left inner edge, lit bottom/right), an inset frame.
  c.rect(21, 13, 22, 1, 'o');
  c.rect(21, 13, 1, 17, 'o');
  c.rect(24, 16, 16, 11, '1');
  c.ring(24, 16, 16, 11, '2');
  c.rect(24, 16, 16, 1, 'o');
  c.rect(24, 16, 1, 11, 'o');
  // Plinth.
  c.rect(1, 30, 62, 1, 'o');
  c.rect(3, 30, 15, 1, '1');
  c.rect(46, 30, 15, 1, '1');
  return c.grid();
}

/**
 * CTO desk items, 32x12, set on the top in front of the CTO: a pen cup (left), a
 * green felt blotter with a letter on it, and a brass nameplate on a wood wedge
 * (abstract marks, no text). The rows above the desk top stay clear in the middle
 * so the CTO's chest is not covered.
 */
function deskCtoTop(): Grid {
  const c = new Canvas(32, 12);
  // Blotter: green felt pad with dark leather corners.
  c.rect(2, 7, 28, 5, 'g');
  c.rect(2, 7, 28, 1, 'G');
  c.ring(2, 7, 28, 5, 'x');
  c.rect(2, 7, 4, 5, 'o');
  c.rect(26, 7, 4, 5, 'o');
  c.rect(3, 8, 2, 3, '1');
  c.rect(27, 8, 2, 3, '1');
  // A letter on the blotter.
  c.rect(7, 8, 7, 3, 'p');
  c.rect(7, 10, 7, 1, 'q');
  c.rect(8, 9, 4, 1, 'q');
  // Nameplate: wood wedge, brass plate with a lit top edge and abstract marks.
  c.rect(15, 3, 12, 6, 'o');
  c.rect(16, 4, 10, 3, 'k');
  c.rect(16, 4, 10, 1, 'K');
  c.rect(17, 5, 3, 1, 'j');
  c.rect(21, 5, 4, 1, 'j');
  c.rect(16, 7, 10, 1, '2');
  c.rect(16, 7, 1, 1, '3');
  // Pen cup on the left with three pens.
  c.rect(0, 4, 5, 6, 'o');
  c.rect(1, 5, 3, 4, 'n');
  c.set(1, 5, 'N');
  c.set(1, 2, 'b');
  c.set(1, 3, 'b');
  c.set(2, 1, 'r');
  c.set(2, 2, 'r');
  c.set(2, 3, 'r');
  c.set(3, 3, 'p');
  c.set(1, 4, 'b');
  c.set(2, 4, 'r');
  c.set(3, 4, 'p');
  return c.grid();
}

/**
 * Banker's lamp, 16x24: a green glass half-cylinder shade with a lit top-left
 * highlight and a warm glow line under it, a brass stem with a pull chain and a
 * stepped brass base.
 */
function lampCto(): Grid {
  const c = new Canvas(16, 24);
  // Shade, rows 3-9: rounded top, glass body, a highlight band, a shaded rim.
  c.rect(4, 3, 8, 1, 'g');
  c.rect(2, 4, 12, 3, 'g');
  c.rect(1, 7, 14, 3, 'g');
  c.rect(4, 4, 6, 1, 'G');
  c.rect(3, 5, 2, 1, 'G');
  c.rect(10, 5, 3, 2, 'd');
  c.rect(2, 8, 12, 1, 'd');
  c.outline('x');
  // Warm light under the shade: the rim glow and the bulb.
  c.rect(2, 10, 12, 1, 'L');
  c.rect(4, 10, 8, 1, 'l');
  // Brass finial, stem (lit left, shaded right), pull chain with a bead.
  c.rect(7, 2, 2, 1, 'k');
  c.set(7, 2, 'K');
  c.rect(7, 11, 2, 8, 'k');
  c.rect(7, 11, 1, 8, 'K');
  c.rect(9, 11, 1, 8, 'o');
  c.rect(12, 11, 1, 3, 'j');
  c.set(12, 14, 'k');
  // Base: a small upper step on a wide lower step, lit top-left, outlined.
  c.rect(4, 19, 8, 1, 'o');
  c.rect(3, 20, 10, 1, 'o');
  c.rect(4, 20, 8, 1, 'k');
  c.rect(4, 20, 3, 1, 'K');
  c.rect(1, 21, 14, 3, 'o');
  c.rect(2, 21, 12, 1, 'k');
  c.rect(2, 21, 4, 1, 'K');
  c.rect(2, 22, 12, 1, 'j');
  return c.grid();
}

/**
 * CTO chair, 24x28: a tall oxblood leather back with a rounded top, tufted with a
 * button grid, padded arms, a seat, a gas lift and a five-star base on castors.
 */
function chairCto(): Grid {
  const c = new Canvas(24, 28);
  // Back, rows 0-17, rounded top corners; lit top/left, shaded right.
  c.rect(4, 0, 16, 1, '2');
  c.rect(3, 1, 18, 17, '2');
  c.rect(4, 1, 1, 16, '3');
  c.rect(5, 1, 14, 1, '3');
  c.rect(19, 2, 1, 15, '1');
  // Tufting: buttons (a dark dimple with a shadow under it), middle row offset.
  for (const by of [4, 8, 12]) {
    for (const bx of [6, 10, 14]) {
      const x = bx + (by === 8 ? 2 : 0);
      c.set(x, by, 'o');
      c.set(x, by + 1, '1');
    }
  }
  // Arms, rows 13-18: padded rolls with a lit top.
  for (const ax of [0, 19]) {
    c.rect(ax, 13, 5, 6, '2');
    c.rect(ax, 13, 5, 1, '3');
    c.rect(ax, 18, 5, 1, '1');
  }
  // Seat, rows 17-20.
  c.rect(4, 17, 16, 4, '2');
  c.rect(4, 17, 16, 1, '3');
  c.rect(4, 20, 16, 1, '1');
  c.outline('o');
  // Gas lift, five-star base (night metal), castors.
  c.rect(10, 21, 4, 3, 'z');
  c.rect(11, 21, 2, 3, 'm');
  c.set(11, 21, 'M');
  c.rect(2, 23, 20, 3, 'z');
  c.rect(3, 24, 18, 1, 'm');
  c.rect(3, 24, 7, 1, 'M');
  for (const wx of [2, 11, 20]) c.rect(wx, 26, 2, 2, 'z');
  return c.grid();
}

/**
 * Visitor chair, 20x20, seen from behind (it faces the CTO's desk): a curved
 * crest rail on two posts, three spindles with the green seat cushion showing
 * between them, the seat's front edge, and four legs with a stretcher.
 */
function chairVisitor(): Grid {
  const c = new Canvas(20, 20);
  // Seat (behind the back): cushion on a wooden seat board, rows 7-12.
  c.rect(1, 7, 18, 3, 'g');
  c.rect(1, 7, 18, 1, 'G');
  c.rect(1, 10, 18, 2, '2');
  c.rect(1, 10, 18, 1, '3');
  c.rect(1, 12, 18, 1, '1');
  // Back posts (lit left face, shaded right face), cols 2-3 and 16-17.
  for (const px of [2, 16]) {
    c.rect(px, 1, 2, 12, '2');
    c.rect(px, 1, 1, 12, '3');
  }
  c.rect(17, 2, 1, 11, '1');
  // Crest rail, rows 0-3: curved top, lit top row, shaded underside.
  c.rect(4, 0, 12, 1, '2');
  c.rect(2, 1, 16, 3, '2');
  c.rect(3, 1, 14, 1, '3');
  c.rect(2, 3, 16, 1, '1');
  // Spindles, rows 4-9.
  for (const sx of [6, 9, 12]) {
    c.rect(sx, 4, 2, 6, '2');
    c.rect(sx, 4, 1, 6, '3');
  }
  // Legs, rows 13-19; back legs (inner) darker; a stretcher.
  for (const lx of [2, 16]) {
    c.rect(lx, 13, 2, 7, '2');
    c.set(lx, 13, '3');
  }
  for (const lx of [5, 13]) c.rect(lx, 13, 2, 5, '1');
  c.outline('o');
  c.rect(4, 15, 12, 1, 'o');
  return c.grid();
}

/** Terracotta pot of the tall plant, rows 21-31 (16 wide): outline, lit rim and left side, shaded right side. */
const POT = [
  '.uuuuuuuuuuuuuu.',
  '.uTTTTTTTTTTTtu.',
  '.uTtttttttttttu.',
  '..uuuuuuuuuuuu..',
  '..uTttttttttuu..',
  '..uTttttttttuu..',
  '...uTttttttuu...',
  '...uTttttttuu...',
  '...uTttttttuu...',
  '....uTttttuu....',
  '.....uuuuuu.....',
];

/**
 * Tall plant, 16x32: a snake-plant fan of upright blade leaves (lit left edge,
 * shaded right edge, a bright streak on the leaves nearest the light) growing
 * out of a terracotta pot.
 */
function plantTall(): Grid {
  const c = new Canvas(16, 32);
  // Leaves, back to front: [base x, top y, lean (px per 4 rows), width].
  const leaves: [number, number, number, number][] = [
    [8, 1, 0, 3],
    [4, 5, -1, 3],
    [11, 6, 1, 3],
    [6, 10, -1, 3],
    [10, 11, 1, 3],
    [8, 13, 0, 3],
  ];
  for (const [bx, top, lean, w] of leaves) {
    for (let y = top; y < 23; y++) {
      const dx = Math.round(((23 - y) * lean) / 4);
      const width = y < top + 2 ? 1 : y < top + 4 ? 2 : w;
      for (let i = 0; i < width; i++) c.set(bx + dx + i, y, i === 0 ? 'G' : i === width - 1 && width > 2 ? 'g' : 'G');
      // Dark gap left of each blade separates it from the one behind.
      if (y > top) c.set(bx + dx - 1, y, 'x');
    }
  }
  c.outline('x');
  // Light streaks near the tips of the leaves facing the upper left.
  for (const [x, y, n] of [
    [8, 4, 4],
    [4, 9, 3],
    [6, 14, 3],
  ] as const) {
    c.rect(x, y, 1, n, 'h');
  }
  POT.forEach((row, j) => {
    for (let x = 0; x < 16; x++) if (row[x] !== '.') c.set(x, 21 + j, row[x] ?? '.');
  });
  return c.grid();
}


/**
 * CTO rug, 64x32: a woven rug with cream fringe on the short ends, a double
 * border, a dark field and a central diamond medallion with corner motifs,
 * lit along its top/left border.
 */
function rugCto(): Grid {
  const W = 64;
  const H = 32;
  return grid(W, H, (x, y) => {
    // Fringe: 2 px at each short end, every other row.
    if (x < 2 || x >= W - 2) return y >= 1 && y < H - 1 && y % 2 === 1 ? 'f' : '.';
    const ix = x - 2;
    const iw = W - 4;
    const edge = Math.min(ix, y, iw - 1 - ix, H - 1 - y);
    if (edge === 0) return 'o';
    if (edge === 1) return ix === 1 || y === 1 ? 'B' : 'b';
    if (edge === 2) return 'o';
    if (edge === 3) return (ix + y) % 4 === 0 ? 'B' : 'r';
    if (edge === 4) return 'o';
    // Field with a medallion: diamond distance from the centre.
    const cx = Math.abs(ix + 0.5 - iw / 2);
    const cy = Math.abs(y + 0.5 - H / 2);
    const d = cx / 2 + cy;
    if (d < 3) return 'B';
    if (d < 4) return 'o';
    if (d < 7) return (x + y) % 2 === 0 ? 'r' : 'R';
    if (d < 8) return 'b';
    // Corner motifs: small diamonds near each field corner.
    const kx = Math.min(ix - 5, iw - 6 - ix);
    const ky = Math.min(y - 5, H - 6 - y);
    if (kx >= 0 && ky >= 0 && Math.abs(kx - 3) + Math.abs(ky - 2) <= 1) return 'b';
    return 'R';
  });
}

/**
 * Desk, 32x24: a wood top 5 rows deep (keyboard, monitor and lamp stand on it),
 * the nosing, and a full-height front panel that hides the sitter's lower body:
 * a recessed panel with a pencil drawer, on a dark kick plinth.
 */
function desk(light: boolean): Grid {
  const c = new Canvas(32, 24);
  c.rect(0, 0, 32, 24, 'o');
  deskTop(c, 5, light ? 11 : 5, light ? { body: '3', lit: 'L', grain: '2' } : undefined);
  // Front panel, rows 9-21.
  c.rect(1, 9, 30, 13, light ? '2' : '1');
  if (light) {
    // Open desk: lighter wood, two square legs (lit left face, shaded right face)
    // framing a plain modesty panel with one recessed inset, no drawer.
    for (const lx of [1, 27]) {
      c.rect(lx, 9, 4, 13, '2');
      c.rect(lx, 9, 1, 13, '3');
      c.rect(lx + 3, 9, 1, 13, '1');
    }
    c.rect(5, 9, 22, 1, '1');
    c.rect(7, 11, 18, 9, '2');
    c.rect(7, 11, 18, 1, '1');
    c.rect(7, 11, 1, 9, '1');
    c.rect(8, 19, 17, 1, '3');
    c.rect(24, 12, 1, 8, '3');
  } else {
    // Recessed panel (shadow top/left inside, lit bottom/right), pencil drawer on top.
    c.rect(3, 13, 26, 8, '1');
    c.rect(3, 13, 26, 1, 'o');
    c.rect(3, 13, 1, 8, 'o');
    c.rect(4, 20, 25, 1, '2');
    c.rect(28, 14, 1, 7, '2');
    drawer(c, 9, 9, 14, 4);
  }
  // Kick plinth.
  c.rect(1, 22, 30, 1, 'o');
  return c.grid();
}

/**
 * Monitor, 14x14, beside the sitter and turned towards them (screen faces right):
 * we see the casing's side and back (lit top-left, a vent), the bezel and a
 * foreshortened screen whose edge glows; a neck and a foot. `on` = lit screen
 * (blue with green text rows), else dark glass with one reflection.
 */
function monitor(on: boolean): Grid {
  const c = new Canvas(14, 14);
  // Casing back (bulge), cols 1-5, rows 2-8.
  c.rect(1, 2, 5, 7, 'm');
  c.rect(1, 2, 5, 1, 'M');
  c.rect(1, 2, 1, 7, 'M');
  c.rect(2, 5, 3, 1, 'z');
  c.rect(2, 7, 3, 1, 'z');
  // Bezel frame, cols 5-11, rows 0-10, skewed: its near (right) edge taller.
  c.rect(5, 1, 3, 9, 'm');
  c.rect(5, 1, 1, 9, 'M');
  c.rect(8, 0, 4, 11, 'm');
  // Screen, foreshortened inside the bezel.
  if (on) {
    c.rect(8, 1, 3, 9, 'b');
    c.rect(10, 1, 1, 9, 'B');
    for (const y of [2, 4, 6]) c.set(8, y, 'e');
    c.set(9, 3, 'e');
    c.set(9, 6, 'e');
    c.set(8, 8, 'B');
  } else {
    c.rect(8, 1, 3, 9, 'z');
    c.rect(9, 2, 1, 2, 'm');
    c.set(10, 1, 'M');
  }
  c.outline('z');
  // Glow edge: the screen's near rim lit in the screen colour (only when on).
  if (on) {
    c.rect(11, 1, 1, 9, 'B');
    c.rect(12, 2, 1, 7, 'b');
  }
  // Neck and foot.
  c.rect(5, 11, 3, 1, 'z');
  c.rect(6, 11, 1, 1, 'm');
  c.rect(2, 12, 10, 2, 'z');
  c.rect(3, 12, 8, 1, 'm');
  c.rect(3, 12, 3, 1, 'M');
  return c.grid();
}

/**
 * Desk lamp, 10x16: a dome shade in cloth orange (lit top-left, warm glow on its
 * rim and bulb), a thin stem and a round base. Symmetric, so it works on either
 * side of a desk; the shade keeps to cols 2-7 so it never covers the sitter's head.
 */
function lampDesk(): Grid {
  const c = new Canvas(10, 16);
  c.rect(3, 0, 4, 1, 's');
  c.rect(2, 1, 6, 4, 's');
  c.rect(3, 1, 2, 1, 'S');
  c.rect(2, 2, 1, 2, 'S');
  c.rect(6, 2, 2, 3, 'x');
  c.outline('x');
  c.rect(3, 0, 1, 1, 's');
  // Glow under the shade: rim and bulb.
  c.rect(3, 5, 4, 1, 'L');
  c.rect(4, 5, 2, 1, 'l');
  // Stem.
  c.rect(4, 6, 2, 7, 'z');
  c.set(4, 7, 'M');
  c.set(4, 8, 'M');
  c.set(4, 9, 'm');
  c.set(4, 10, 'm');
  // Base.
  c.rect(1, 13, 8, 3, 'z');
  c.rect(2, 13, 6, 2, 'm');
  c.rect(2, 13, 3, 1, 'M');
  return c.grid();
}

/**
 * Office chair, 20x20: a mesh back with a rounded top and a lit rim (the part
 * that shows above the desk), arms, a seat, a gas lift and a star base.
 */
function chair(): Grid {
  const c = new Canvas(20, 20);
  // Back, rows 0-10.
  c.rect(4, 1, 12, 9, '2');
  c.rect(5, 0, 10, 1, '2');
  c.rect(5, 1, 10, 1, '3');
  c.rect(4, 2, 1, 7, '3');
  c.rect(15, 2, 1, 8, '1');
  for (let y = 3; y < 9; y += 2) c.rect(6, y, 8, 1, '1');
  // Arms and seat, rows 8-12.
  c.rect(1, 8, 3, 4, '2');
  c.rect(16, 8, 3, 4, '2');
  c.rect(1, 8, 3, 1, '3');
  c.rect(16, 8, 3, 1, '3');
  c.rect(3, 10, 14, 3, '2');
  c.rect(3, 10, 14, 1, '3');
  c.rect(3, 12, 14, 1, '1');
  c.outline('o');
  // Gas lift, star base, castors.
  c.rect(9, 13, 2, 3, '1');
  c.set(9, 13, '2');
  c.rect(3, 16, 14, 2, 'o');
  c.rect(4, 16, 12, 1, '1');
  c.rect(4, 16, 4, 1, '2');
  for (const wx of [2, 9, 16]) c.rect(wx, 18, 2, 2, 'o');
  return c.grid();
}

/** Stool, 14x10: a round wooden seat (lit top-left, shaded rim), three metal legs and a foot ring. */
function stool(): Grid {
  const c = new Canvas(14, 10);
  c.rect(2, 0, 10, 1, '2');
  c.rect(1, 1, 12, 2, '2');
  c.rect(3, 1, 4, 1, '3');
  c.rect(2, 2, 2, 1, '3');
  c.rect(1, 3, 12, 1, '1');
  c.rect(2, 4, 10, 1, '1');
  c.outline('o');
  // Legs (night metal) and foot ring.
  for (const lx of [2, 6, 10]) c.rect(lx, 5, 2, 5, 'z');
  c.set(2, 5, 'M');
  c.set(6, 5, 'M');
  c.set(10, 5, 'M');
  c.rect(3, 7, 8, 1, 'm');
  c.rect(2, 7, 1, 1, 'z');
  c.rect(11, 7, 1, 1, 'z');
  return c.grid();
}

/** Keyboard, 12x4: a flat dark slab seen from its far side, key caps as lit dots, a space bar. */
function keyboard(): Grid {
  return grid(12, 4, (x, y) => {
    if (x === 0 || x === 11 || y === 0 || y === 3) return 'z';
    if (y === 1) return x % 2 === 1 ? 'M' : 'm';
    return x >= 3 && x <= 8 ? 'M' : x % 2 === 0 ? 'M' : 'm';
  });
}

/** Mug, 6x6: a magenta mug with a dark coffee top, a lit left side and a handle on the right. */
function mug(): Grid {
  return [
    'oooo..',
    'occo..',
    'o32ooo',
    'o32o.o',
    'o22ooo',
    '.ooo..',
  ];
}

/** Papers, 10x6: a loose stack of three sheets (abstract text lines, no words) with a clip. */
function papers(): Grid {
  return [
    '...ooooooo',
    '.oo3333333',
    'o333-3--3o',
    'o3--3333oo',
    'o3333--3o.',
    'ooooooooo.',
  ].map((row) => row.replaceAll('-', '2'));
}

const WOOD = { o: 'wood0', '1': 'wood1', '2': 'wood2', '3': 'wood3' };
const BRASS = { k: 'lamp1', K: 'lamp2', j: 'lamp0' };
/** Dark metal and plastic (monitor casing, chair bases, lamp stems): outline, body, lit edge. */
const METAL = { z: 'night0', m: 'night2', M: 'night3' };
const PLANT = { x: 'green0', g: 'green0', G: 'green1', h: 'screen1' };

const MONITOR_KEY = { ...METAL, b: 'screen0', B: 'night4', e: 'screen1' };

/** The furniture sprites of the `props` family. */
export const SPRITES: SpriteDef[] = [
  { id: 'desk-cto', w: 64, h: 32, grid: deskCto(), key: { ...WOOD, ...BRASS } },
  {
    id: 'desk-cto-top',
    w: 32,
    h: 12,
    grid: deskCtoTop(),
    key: {
      ...WOOD,
      ...BRASS,
      g: 'green0',
      G: 'green1',
      x: 'night1',
      p: 'lamp2',
      q: 'night4',
      n: 'night2',
      N: 'night3',
      b: 'blue1',
      r: 'orange1',
    },
  },
  {
    id: 'lamp-cto',
    w: 16,
    h: 24,
    grid: lampCto(),
    key: { o: 'wood0', ...BRASS, x: 'night1', g: 'green0', G: 'green1', d: 'night1', L: 'lamp1', l: 'lamp2' },
  },
  {
    id: 'chair-cto',
    w: 24,
    h: 28,
    grid: chairCto(),
    key: { o: 'wood0', '1': 'wood1', '2': 'orange0', '3': 'wood2', ...METAL },
  },
  { id: 'chair-visitor', w: 20, h: 20, grid: chairVisitor(), key: { ...WOOD, g: 'green0', G: 'green1', x: 'night1' } },
  {
    id: 'plant-tall',
    w: 16,
    h: 32,
    grid: plantTall(),
    key: { ...PLANT, t: 'orange0', T: 'orange1', u: 'wood0' },
  },
  {
    id: 'rug-cto',
    w: 64,
    h: 32,
    grid: rugCto(),
    key: { o: 'night1', f: 'lamp2', b: 'orange0', B: 'lamp0', r: 'magenta0', R: 'night2' },
  },
  { id: 'desk', w: 32, h: 24, grid: desk(false), key: { ...WOOD, ...BRASS } },
  { id: 'desk-open', w: 32, h: 24, grid: desk(true), key: { ...WOOD, ...BRASS, L: 'lamp0' } },
  { id: 'monitor', w: 14, h: 14, grid: monitor(true), key: MONITOR_KEY },
  { id: 'monitor-off', w: 14, h: 14, grid: monitor(false), key: MONITOR_KEY },
  { id: 'monitor-l', w: 14, h: 14, grid: mirror(monitor(true)), key: MONITOR_KEY },
  { id: 'monitor-off-l', w: 14, h: 14, grid: mirror(monitor(false)), key: MONITOR_KEY },
  {
    id: 'lamp-desk',
    w: 10,
    h: 16,
    grid: lampDesk(),
    key: { ...METAL, x: 'orange0', s: 'orange1', S: 'lamp0', L: 'lamp1', l: 'lamp2' },
  },
  { id: 'chair', w: 20, h: 20, grid: chair(), key: { o: 'night0', '1': 'night1', '2': 'night2', '3': 'night3', ...METAL } },
  { id: 'stool', w: 14, h: 10, grid: stool(), key: { ...WOOD, ...METAL } },
  { id: 'keyboard', w: 12, h: 4, grid: keyboard(), key: METAL },
  { id: 'mug', w: 6, h: 6, grid: mug(), key: { o: 'magenta0', '2': 'magenta1', '3': 'lamp2', c: 'wood0' } },
  { id: 'papers', w: 10, h: 6, grid: papers(), key: { o: 'night3', '2': 'night4', '3': 'lamp2' } },
];
