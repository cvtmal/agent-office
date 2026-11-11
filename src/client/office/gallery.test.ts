import { describe, expect, it } from 'vitest';
import sample from '../../../fixtures/snapshots/sample.json';
import type { Snapshot } from '../../shared/types.js';
import { GALLERY_COLS, GALLERY_IDS, GALLERY_LOOKS, GALLERY_ROWS, galleryEntries } from './gallery.js';
import { SCENE_H, SCENE_W } from './layout.js';
import { lookFor, lookKey } from './look.js';

const snapshot = sample as unknown as Snapshot;

describe('galleryEntries', () => {
  const entries = galleryEntries(snapshot.characters);
  // Rows after the synthetic looks hold the first characters; the rest are left out.
  const shown = snapshot.characters.slice(0, (GALLERY_ROWS.length - Math.ceil(GALLERY_LOOKS / GALLERY_COLS)) * GALLERY_COLS);

  it('has the 30 gallery looks and the first 15 sample characters', () => {
    expect(GALLERY_IDS).toHaveLength(GALLERY_LOOKS);
    expect(GALLERY_IDS[0]).toBe('look-00');
    expect(GALLERY_IDS[29]).toBe('look-29');
    expect(shown).toHaveLength(15);
    expect(entries).toHaveLength(GALLERY_LOOKS + shown.length);
    expect(new Set(entries.map((e) => e.id)).size).toBe(entries.length);
  });

  it('gives sample agents the intern look, as the room does', () => {
    for (const c of shown) {
      const e = entries.find((x) => x.id === c.id);
      expect(e?.intern, c.id).toBe(c.kind === 'agent');
      expect(e?.look && lookKey(e.look)).toBe(lookKey(lookFor(c.id, c.kind === 'agent')));
    }
  });

  it('keeps every frame inside the scene and frames in one row from overlapping', () => {
    for (const e of entries) {
      const w = e.intern === true ? 24 : 32;
      const h = e.intern === true ? 36 : 48;
      expect(e.x, e.id).toBeGreaterThanOrEqual(0);
      expect(e.y, e.id).toBeGreaterThanOrEqual(0);
      expect(e.x + w, e.id).toBeLessThanOrEqual(SCENE_W);
      expect(e.y + h, e.id).toBeLessThanOrEqual(SCENE_H);
      expect(Number.isInteger(e.x) && Number.isInteger(e.y), e.id).toBe(true);
      expect(e.sortY).toBe(e.y + h);
    }
    const feet = (e: (typeof entries)[number]): number => e.x + (e.intern === true ? 12 : 16);
    for (const a of entries) {
      for (const b of entries) {
        if (a !== b && a.sortY === b.sortY) expect(Math.abs(feet(a) - feet(b))).toBeGreaterThanOrEqual(30);
      }
    }
  });

  it('carries the tag text (name, truncated)', () => {
    expect(entries.find((e) => e.id === 'look-07')?.tag).toBe('look-07');
    const cto = snapshot.characters.find((c) => c.name === 'cto-2');
    expect(entries.find((e) => e.id === cto?.id)?.tag).toBe('cto-2');
    for (const e of entries) expect([...e.tag].length).toBeLessThanOrEqual(10);
  });
});
