// Sprite preview (plan P-1). The always-run test checks the PNG encoder; with
// SPRITE_PNG=1 (`make sprites`) it writes one sheet per sprite family, scaled 4x
// with a 1-px grid gap on a mid-night background, to var/sprites/<family>.png,
// plus var/sprites/palette.png (one row per ramp, dark -> light).
// Importing the sprite code here, under tsconfig.node.json (no DOM lib), is what
// makes `make lint` enforce the DOM-free rule.
import { mkdirSync, writeFileSync } from 'node:fs';
import { inflateSync, crc32 } from 'node:zlib';
import { describe, expect, it, test } from 'vitest';
import { RAMPS, ramp, rgba, type RampName } from '../src/client/render/palette.js';
import { blank, blit, compose, rasterize, scale, type Raster } from '../src/client/render/raster.js';
import { GLYPHS, textRaster } from '../src/client/render/font.js';
import { FAMILIES, rasterizeSprite } from '../src/client/sprites/registry.js';
import { composeCharacter } from '../src/client/sprites/characters/compose.js';
import { portraitFor } from '../src/client/sprites/characters/portrait.js';
import { composeIntern } from '../src/client/sprites/interns/index.js';
import { galleryEntries } from '../src/client/office/gallery.js';
import type { Snapshot } from '../src/shared/types.js';
import sampleJson from '../fixtures/snapshots/sample.json' with { type: 'json' };
import { PNG_SIGNATURE, encodePng } from './sprite-png.js';

const OUT = new URL('../var/sprites/', import.meta.url);
const SCALE = 4;
const GAP = 1;
const MAX_ROW = 240;

/** A w x h raster filled with one palette colour. */
function solid(w: number, h: number, name: string): Raster {
  const r = blank(w, h);
  const px = rgba(name);
  for (let i = 0; i < w * h; i++) r.data.set(px, i * 4);
  return r;
}

/** Packs rasters left to right in rows (wrapping at MAX_ROW px), each on a night2 cell, night1 gaps. */
function sheet(items: readonly Raster[]): Raster {
  const placed: { r: Raster; x: number; y: number }[] = [];
  let x = GAP;
  let y = GAP;
  let rowH = 0;
  let width = GAP;
  for (const r of items) {
    if (x > GAP && x + r.w + GAP > MAX_ROW) {
      x = GAP;
      y += rowH + GAP;
      rowH = 0;
    }
    placed.push({ r, x, y });
    x += r.w + GAP;
    rowH = Math.max(rowH, r.h);
    width = Math.max(width, x);
  }
  const out = solid(Math.max(width, 8), Math.max(y + rowH + GAP, 8), 'night1');
  for (const p of placed) {
    blit(out, solid(p.r.w, p.r.h, 'night2'), p.x, p.y);
    blit(out, p.r, p.x, p.y);
  }
  return out;
}

/** Writes a raster scaled 4x to var/sprites/<name>.png. */
function writeSheet(name: string, r: Raster): void {
  mkdirSync(OUT, { recursive: true });
  writeFileSync(new URL(`${name}.png`, OUT), encodePng(scale(r, SCALE)));
}

/** The chunks of a PNG file, CRC-checked. */
function chunks(png: Buffer): { type: string; data: Buffer }[] {
  const out: { type: string; data: Buffer }[] = [];
  let at = 8;
  while (at < png.length) {
    const len = png.readUInt32BE(at);
    const type = png.toString('latin1', at + 4, at + 8);
    const data = png.subarray(at + 8, at + 8 + len);
    expect(png.readUInt32BE(at + 8 + len), `${type} crc`).toBe(crc32(png.subarray(at + 4, at + 8 + len)) >>> 0);
    out.push({ type, data });
    at += 12 + len;
  }
  return out;
}

describe('encodePng', () => {
  it('writes a valid 2x2 RGBA PNG', () => {
    const r = rasterize(['ab', 'b.'], { a: 'night0', b: 'lamp2' });
    const png = encodePng(r);
    expect(png.subarray(0, 8)).toEqual(PNG_SIGNATURE);
    const cs = chunks(png);
    expect(cs.map((c) => c.type)).toEqual(['IHDR', 'IDAT', 'IEND']);
    const ihdr = cs[0]?.data ?? Buffer.alloc(0);
    expect(ihdr.readUInt32BE(0)).toBe(2);
    expect(ihdr.readUInt32BE(4)).toBe(2);
    expect([...ihdr.subarray(8, 13)]).toEqual([8, 6, 0, 0, 0]);
    const raw = inflateSync(cs[1]?.data ?? Buffer.alloc(0));
    expect([...raw]).toEqual([0, ...rgba('night0'), ...rgba('lamp2'), 0, ...rgba('lamp2'), 0, 0, 0, 0]);
  });
});

describe('sprite preview sheets', () => {
  test.skipIf(!process.env['SPRITE_PNG'])('writes var/sprites/<family>.png and palette.png', () => {
    for (const family of FAMILIES) {
      writeSheet(family.name, sheet(family.sprites.map((s) => rasterizeSprite(s))));
    }
    // Font: the full charset in lines of 24, then sample name tags boxed as P-13 does
    // (1-px night0 outline, night1 fill, 1-px padding, cream text).
    const chars = [...GLYPHS.keys()];
    const lines = Array.from({ length: Math.ceil(chars.length / 24) }, (_, i) =>
      chars.slice(i * 24, i * 24 + 24).join(''),
    );
    const tag = (t: string): Raster => {
      const text = textRaster(t, 'lamp2');
      const box = solid(text.w + 4, text.h + 4, 'night0');
      blit(box, solid(text.w + 2, text.h + 2, 'night1'), 1, 1);
      blit(box, text, 2, 2);
      return box;
    };
    const tags = ['c03-implement', 'explore-im…', 'cto-2', 'reviewer', 'a1b2c3d4', 'W0 #2 v0.9'];
    writeSheet('font', sheet([...lines.map((l) => textRaster(l, 'lamp2')), ...tags.map(tag)]));
    // Looks (phase 13, P-12): the 30 gallery looks and the 14 sample looks, as the
    // gallery lays them out (frame 0, on a night2 floor), then every look's 4 idle
    // frames side by side for the first 6 gallery looks; and their portraits.
    const entries = galleryEntries((sampleJson as unknown as Snapshot).characters);
    const floor = solid(480, 270, 'night2');
    for (const e of entries) {
      if (e.look === undefined) continue;
      blit(floor, e.intern === true ? composeIntern(e.look, 0) : composeCharacter(e.look, 0), e.x, e.y);
    }
    const idle = entries
      .slice(0, 6)
      .flatMap((e) => ([0, 1, 2, 3] as const).map((f) => (e.look ? composeCharacter(e.look, f) : blank(1, 1))));
    writeSheet('looks', sheet([floor, ...idle]));
    writeSheet(
      'portraits',
      sheet(entries.flatMap((e) => (e.look === undefined ? [] : [portraitFor(e.look, e.intern === true)]))),
    );

    const names = Object.keys(RAMPS) as RampName[];
    const swatches = names.flatMap((name, row) =>
      ramp(name).map((c, i) => ({ raster: solid(12, 12, c), dx: GAP + i * 13, dy: GAP + row * 13 })),
    );
    // Neutral grey (not a palette colour) behind the swatches, so none disappears.
    const bg = blank(GAP + 5 * 13, GAP + names.length * 13);
    for (let i = 0; i < bg.w * bg.h; i++) bg.data.set([0x60, 0x60, 0x60, 255], i * 4);
    writeSheet('palette', compose(bg.w, bg.h, [{ raster: bg, dx: 0, dy: 0 }, ...swatches]));
  });
});
