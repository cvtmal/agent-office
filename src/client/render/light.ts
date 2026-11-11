// The light layer (plan P-8, art direction § Light): the room is multiplied by a night
// tint, except inside pixel-ellipse pools around each lit lamp, whose hard-edged bands
// get warmer towards the centre; a second, mostly transparent raster of lamp cores is
// composited with `screen`. Pure: a function of the lit lamps and the theme. DOM-free.
import { SCENE_HEIGHT, SCENE_WIDTH } from '../../shared/constants.js';
import { rgba, type Rgba } from './palette.js';
import { blank, type Raster } from './raster.js';

/**
 * A lit lamp: its id and centre. Kinds by prefix: `lamp:<spot>` (desk lamp, `lamp:cto`),
 * `glow:<spot>` (monitor), `lamp:coffee`, `moon:window`, and theme lights `neon:sign`,
 * `neon:fairy`.
 */
export interface LitLamp {
  id: string;
  x: number;
  y: number;
}

/** The two colours a theme gives the light (structurally `office/theme.ts` `Theme`). */
export interface LightTheme {
  /** Fill of the multiply layer outside every pool. */
  nightTint: string;
  /** Warmest (innermost) band of a lamp pool. */
  lampTint: string;
}

/** The two composited layers, each scene-sized. */
export interface LightLayers {
  /** Opaque; composited with `multiply`. */
  multiply: Raster;
  /** Transparent except lamp cores; composited with `screen`. */
  screen: Raster;
}

/**
 * One band of a pool: radii, its level (1 outer ... 3 inner), optionally a rectangle
 * instead of an ellipse, and optionally its own colour instead of the level's colour
 * (a tinted light such as a neon tube).
 */
interface Band {
  rx: number;
  ry: number;
  level: 1 | 2 | 3;
  rect?: boolean;
  colour?: string;
}

/** One kind of light source: its bands (outer first), pool offset and core. */
interface PoolDef {
  dy: number;
  bands: readonly Band[];
  core?: { rx: number; ry: number; colour: string; alpha: number };
}

const DESK_LAMP: PoolDef = {
  dy: 8,
  bands: [
    { rx: 44, ry: 26, level: 1 },
    { rx: 30, ry: 18, level: 2 },
    { rx: 15, ry: 9, level: 3 },
  ],
  core: { rx: 3, ry: 2, colour: 'lamp1', alpha: 255 },
};

const POOLS: Readonly<Record<string, PoolDef>> = {
  lamp: DESK_LAMP,
  glow: {
    dy: 0,
    bands: [
      { rx: 18, ry: 12, level: 1 },
      { rx: 9, ry: 6, level: 2 },
    ],
    core: { rx: 5, ry: 3, colour: 'screen0', alpha: 96 },
  },
  coffee: {
    dy: 6,
    bands: [
      { rx: 34, ry: 22, level: 1 },
      { rx: 20, ry: 13, level: 2 },
      { rx: 9, ry: 6, level: 3 },
    ],
    core: { rx: 2, ry: 2, colour: 'lamp0', alpha: 255 },
  },
  // The moonlit glass of the window (80x48 sprite, frame 4 px): the sky keeps its blues
  // while the wall around it stays in the night tint. Hard rectangle, no halo.
  moon: {
    dy: 0,
    bands: [{ rx: 36, ry: 20, level: 1, rect: true }],
  },
  // Neon sign: a magenta spill on the wall around the tube, a bright core.
  neon: {
    dy: 0,
    bands: [
      { rx: 30, ry: 20, level: 1, colour: 'magenta1' },
      { rx: 18, ry: 10, level: 2, colour: 'neon0' },
    ],
    core: { rx: 9, ry: 4, colour: 'magenta0', alpha: 120 },
  },
  // Fairy lights: a thin lavender lift along the string (the bulbs carry the colour).
  fairy: {
    dy: 1,
    bands: [{ rx: 36, ry: 6, level: 1 }],
  },
};

/** Pool of a lamp id: by prefix; `lamp:coffee` and `neon:fairy` are their own kinds. */
function poolFor(id: string): PoolDef {
  if (id === 'lamp:coffee') return POOLS['coffee'] ?? DESK_LAMP;
  if (id === 'neon:fairy') return POOLS['fairy'] ?? DESK_LAMP;
  return POOLS[id.slice(0, id.indexOf(':'))] ?? DESK_LAMP;
}

/** Visits every pixel of the rectangle centred on (cx, cy) with half-sizes rx, ry, clipped. */
function rectangle(
  w: number,
  h: number,
  cx: number,
  cy: number,
  rx: number,
  ry: number,
  visit: (i: number) => void,
): void {
  const x0 = Math.max(0, Math.round(cx - rx));
  const x1 = Math.min(w - 1, Math.round(cx + rx) - 1);
  const y0 = Math.max(0, Math.round(cy - ry));
  const y1 = Math.min(h - 1, Math.round(cy + ry) - 1);
  for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) visit(y * w + x);
}

/** Visits every pixel whose centre lies inside the ellipse (cx, cy, rx, ry), clipped to w x h. */
function ellipse(
  w: number,
  h: number,
  cx: number,
  cy: number,
  rx: number,
  ry: number,
  visit: (i: number) => void,
): void {
  const y0 = Math.max(0, Math.floor(cy - ry));
  const y1 = Math.min(h - 1, Math.ceil(cy + ry));
  for (let y = y0; y <= y1; y++) {
    const dy = (y + 0.5 - cy) / ry;
    if (dy * dy > 1) continue;
    const half = rx * Math.sqrt(1 - dy * dy);
    const x0 = Math.max(0, Math.ceil(cx - half - 0.5));
    const x1 = Math.min(w - 1, Math.floor(cx + half - 0.5));
    for (let x = x0; x <= x1; x++) visit(y * w + x);
  }
}

/**
 * The light of a room. Each pixel takes the highest band level of any pool over it,
 * so overlapping pools merge instead of cutting holes: level 0 = `nightTint`,
 * 1 = `night4` (cool spill), 2 = `lamp2` (cream), 3 = `lampTint` (the warm centre).
 * A band with its own colour paints that colour where it sets the level.
 * Same input -> identical rasters.
 */
export function lightRaster(lamps: readonly LitLamp[], theme: LightTheme, w = SCENE_WIDTH, h = SCENE_HEIGHT): LightLayers {
  const levels = new Uint8Array(w * h);
  // 0 = the level's colour, else 1 + index into `tints`.
  const tintOf = new Uint8Array(w * h);
  const tints: Rgba[] = [];
  const tintIndex = new Map<string, number>();
  const screen = blank(w, h);
  for (const lamp of lamps) {
    const pool = poolFor(lamp.id);
    const cy = lamp.y + pool.dy;
    for (const b of pool.bands) {
      let tint = 0;
      if (b.colour !== undefined) {
        if (!tintIndex.has(b.colour)) {
          tints.push(rgba(b.colour));
          tintIndex.set(b.colour, tints.length);
        }
        tint = tintIndex.get(b.colour) ?? 0;
      }
      const shape = b.rect === true ? rectangle : ellipse;
      shape(w, h, lamp.x, cy, b.rx, b.ry, (i) => {
        if ((levels[i] ?? 0) < b.level) {
          levels[i] = b.level;
          tintOf[i] = tint;
        }
      });
    }
    const core = pool.core;
    if (core !== undefined) {
      const px = rgba(core.colour, core.alpha);
      ellipse(w, h, lamp.x, lamp.y, core.rx, core.ry, (i) => {
        screen.data.set(px, i * 4);
      });
    }
  }
  const ladder: readonly Rgba[] = [rgba(theme.nightTint), rgba('night4'), rgba('lamp2'), rgba(theme.lampTint)];
  const multiply = blank(w, h);
  for (let i = 0; i < levels.length; i++) {
    const t = tintOf[i] ?? 0;
    const colour = t > 0 ? tints[t - 1] : ladder[levels[i] ?? 0];
    multiply.data.set(colour ?? ladder[0] ?? [0, 0, 0, 255], i * 4);
  }
  return { multiply, screen };
}

/** Stable key of a lamp set + theme: the light only needs rebuilding when this changes. */
export function lightKey(lamps: readonly LitLamp[], theme: LightTheme): string {
  const ids = lamps.map((l) => `${l.id}@${String(l.x)},${String(l.y)}`).sort();
  return `${theme.nightTint}|${theme.lampTint}|${ids.join(';')}`;
}
