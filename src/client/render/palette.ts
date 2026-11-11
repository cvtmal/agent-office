// The one palette of the office (art direction § Palette): named ramps, each
// ordered dark -> light. Colour names are `<ramp><index>`, e.g. `night0`, `wood3`.
// DOM-free: imported by sprites, tests and the Node-side PNG preview.

/** Every ramp, dark -> light. Hue-shifted: shadows lean purple, lights lean gold. */
export const RAMPS = {
  /** Dusk purple: near-black outline/shadow, panel, wall, lit wall, lavender highlight. */
  night: ['#1a1022', '#2b1a38', '#45305a', '#6b5286', '#a28fc4'],
  /** Warm wood: dark grain, shadow side, body, lamp-lit edge. */
  wood: ['#3b2128', '#62352a', '#8f5535', '#bf7c45'],
  /** Lamp light: amber glow, gold bulb, cream (also the UI's border/text colour). */
  lamp: ['#e0893a', '#f6c560', '#f2e6c9'],
  /** Fair skin: shadow, base, highlight. */
  skinA: ['#a8605a', '#e5a585', '#f8d0ae'],
  /** Tan skin: shadow, base, highlight. */
  skinB: ['#8a5236', '#c98d62', '#e9b98c'],
  /** Deep skin: shadow, base, highlight. */
  skinC: ['#4a2630', '#7d4532', '#a86a48'],
  /** Cloth green: shade, base. */
  green: ['#2f5a48', '#5e9a5a'],
  /** Cloth blue: shade, base. */
  blue: ['#2c4282', '#4f7fc8'],
  /** Cloth magenta: shade, base. */
  magenta: ['#7a2a62', '#c4508e'],
  /** Cloth orange (also ginger hair): shade, base. */
  orange: ['#8e3826', '#d8642e'],
  /** Neon accents of the neon room: magenta tube, cyan tube. */
  neon: ['#f040b0', '#48e8f0'],
  /** Monitor glow: blue screen, green terminal text. */
  screen: ['#46a6f0', '#62e08c'],
} as const satisfies Record<string, readonly string[]>;

/** Name of a ramp in `RAMPS`. */
export type RampName = keyof typeof RAMPS;

/** Flat map colour name (`night0` ...) -> `#rrggbb`. */
export const PALETTE: Readonly<Record<string, string>> = Object.fromEntries(
  Object.entries(RAMPS).flatMap(([ramp, hexes]) =>
    hexes.map((hex, i): [string, string] => [`${ramp}${String(i)}`, hex]),
  ),
);

/** RGBA bytes of one colour. */
export type Rgba = readonly [number, number, number, number];

/** `#rrggbb` of a palette colour; throws on an unknown name. */
export function colour(name: string): string {
  const hex = PALETTE[name];
  if (hex === undefined) throw new Error(`unknown palette colour: ${name}`);
  return hex;
}

/** RGBA bytes of a palette colour (alpha 0-255, default opaque); throws on an unknown name. */
export function rgba(name: string, alpha = 255): Rgba {
  const n = Number.parseInt(colour(name).slice(1), 16);
  return [(n >> 16) & 0xff, (n >> 8) & 0xff, n & 0xff, alpha];
}

/** Colour names of one ramp, dark -> light (`ramp('wood')` = `['wood0', ..., 'wood3']`). */
export function ramp(name: RampName): string[] {
  return RAMPS[name].map((_, i) => `${name}${String(i)}`);
}

/**
 * Recolour map from one ramp to another for `rasterize`: tone i of `from` -> tone i
 * of `to`, clamped to the last tone when `to` is shorter.
 */
export function rampMap(from: RampName, to: RampName): Record<string, string> {
  const target = ramp(to);
  return Object.fromEntries(
    ramp(from).map((name, i) => [name, target[Math.min(i, target.length - 1)] ?? name]),
  );
}
