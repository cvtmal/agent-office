import { describe, expect, it } from 'vitest';
import sample from '../../../fixtures/snapshots/sample.json';
import { SCENE_WIDTH } from '../../shared/constants.js';
import type { Character, Snapshot } from '../../shared/types.js';
import { measure, textRaster } from '../render/font.js';
import { rgba } from '../render/palette.js';
import { blank } from '../render/raster.js';
import { composeCharacter } from '../sprites/characters/compose.js';
import { composeIntern } from '../sprites/interns/index.js';
import { galleryEntries } from './gallery.js';
import type { Look } from './look.js';
import { buildScene, type DrawItem } from './scene.js';
import {
  TAG_FILL,
  TAG_GAP,
  TAG_HEIGHT,
  TAG_INK,
  TAG_OUTLINE,
  TAG_STEP,
  inkTop,
  layoutTags,
  placeTags,
  tagRaster,
  tagText,
  tagWidth,
  truncateTag,
  type PlacedTextTag,
  type TagInput,
} from './tags.js';

describe('tagText', () => {
  it('falls back name -> agentType -> id prefix', () => {
    expect(tagText({ name: 'c03-implement', agentType: 'Explore', id: 'abcdef0123456' })).toBe('c03-implement');
    expect(tagText({ name: '', agentType: 'Explore', id: 'abcdef0123456' })).toBe('Explore');
    expect(tagText({ name: '', agentType: null, id: 'abcdef0123456' })).toBe('abcdef01');
    expect(tagText({ name: '', agentType: '', id: 'abc' })).toBe('abc');
  });
});

describe('truncateTag', () => {
  it('keeps up to 10 glyphs and cuts longer text to 9 + …', () => {
    expect(truncateTag('owner-docs')).toBe('owner-docs');
    expect(truncateTag('c03-implement')).toBe('c03-imple…');
    expect([...truncateTag('explore-imports')]).toHaveLength(10);
    expect(truncateTag('')).toBe('');
  });
});

describe('placeTags', () => {
  it('leaves non-overlapping tags where they are', () => {
    const out = placeTags([
      { id: 'a', x: 50, y: 100, w: 20 },
      { id: 'b', x: 100, y: 100, w: 20 },
    ]);
    expect(out).toEqual([
      { id: 'a', x: 40, y: 100 - TAG_HEIGHT },
      { id: 'b', x: 90, y: 100 - TAG_HEIGHT },
    ]);
  });

  it('moves the later of two overlapping tags up by 7', () => {
    const out = placeTags(
      [
        { id: 'b', x: 60, y: 100, w: 20, sortY: 120 },
        { id: 'a', x: 50, y: 100, w: 20, sortY: 110 },
      ],
      TAG_STEP,
    );
    expect(out).toEqual([
      { id: 'a', x: 40, y: 93 },
      { id: 'b', x: 50, y: 86 },
    ]);
  });

  it('repeats the move until free (default height needs two steps)', () => {
    const [a, b] = placeTags([
      { id: 'a', x: 50, y: 100, w: 20 },
      { id: 'b', x: 52, y: 100, w: 20, sortY: 101 },
    ]);
    expect(a?.y).toBe(100 - TAG_HEIGHT);
    expect(b?.y).toBe(100 - TAG_HEIGHT - 2 * TAG_STEP);
  });

  it('stops after 3 moves', () => {
    const stack: TagInput[] = [0, 1, 2, 3, 4].map((i) => ({ id: `t${String(i)}`, x: 50, y: 100, w: 20, sortY: i }));
    const out = placeTags(stack, TAG_STEP);
    expect(out.map((t) => t.y)).toEqual([93, 86, 79, 72, 72]);
  });

  it('is deterministic whatever the input order', () => {
    const items: TagInput[] = [
      { id: 'c', x: 50, y: 100, w: 30 },
      { id: 'a', x: 50, y: 100, w: 30 },
      { id: 'b', x: 40, y: 100, w: 30 },
    ];
    const once = placeTags(items);
    expect(placeTags([...items].reverse())).toEqual(once);
    expect(once.map((t) => t.id)).toEqual(['b', 'a', 'c']);
  });
});

describe('tagRaster', () => {
  it('is a night-outlined dark-purple box with cream text and 1-px padding', () => {
    const text = 'c03-imple…';
    const r = tagRaster(text);
    expect(r.w).toBe(measure(text) + 4);
    expect(tagWidth(text)).toBe(r.w);
    expect(r.h).toBe(TAG_HEIGHT);
    const at = (x: number, y: number): number[] => [...r.data.subarray((y * r.w + x) * 4, (y * r.w + x) * 4 + 4)];
    expect(at(0, 0)).toEqual([...rgba(TAG_OUTLINE)]);
    expect(at(r.w - 1, r.h - 1)).toEqual([...rgba(TAG_OUTLINE)]);
    // The padding ring is fill only; the ink sits inside it.
    for (let x = 1; x < r.w - 1; x++) {
      expect(at(x, 1)).toEqual([...rgba(TAG_FILL)]);
      expect(at(x, r.h - 2)).toEqual([...rgba(TAG_FILL)]);
    }
    const ink = textRaster(text, TAG_INK);
    let inked = 0;
    for (let y = 0; y < ink.h; y++) {
      for (let x = 0; x < ink.w; x++) {
        const lit = (ink.data[(y * ink.w + x) * 4 + 3] ?? 0) > 0;
        expect(at(x + 2, y + 2)).toEqual([...rgba(lit ? TAG_INK : TAG_FILL)]);
        if (lit) inked++;
      }
    }
    expect(inked).toBeGreaterThan(20);
  });
});

describe('inkTop', () => {
  it('finds the first opaque row', () => {
    const r = blank(4, 6);
    expect(inkTop(r)).toBe(6);
    r.data[(3 * 4 + 2) * 4 + 3] = 255;
    expect(inkTop(r)).toBe(3);
  });
});

interface Box {
  x: number;
  y: number;
  w: number;
}

function boxOverlap(a: Box, b: Box): boolean {
  return a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + TAG_HEIGHT && b.y < a.y + TAG_HEIGHT;
}

function tagsOf(items: readonly (DrawItem & { text: string })[]): (PlacedTextTag & { w: number })[] {
  const subjects = items.map((it) => {
    const look = it.look as Look;
    const frame = look.intern ? composeIntern(look, 0) : composeCharacter(look, 0);
    return { id: it.id, text: it.text, x: it.x, y: it.y, w: frame.w, sortY: it.sortY, headTop: inkTop(frame) };
  });
  return layoutTags(subjects).map((t) => ({ ...t, w: tagWidth(t.text) }));
}

function expectNoOverlap(tags: readonly (PlacedTextTag & { w: number })[]): void {
  for (let i = 0; i < tags.length; i++) {
    for (let j = i + 1; j < tags.length; j++) {
      const a = tags[i] as PlacedTextTag & { w: number };
      const b = tags[j] as PlacedTextTag & { w: number };
      expect(boxOverlap(a, b), `${a.text} / ${b.text}`).toBe(false);
    }
  }
}

describe('layoutTags', () => {
  it('centres a tag 3 px above the head and keeps it inside the scene width', () => {
    const [a, b] = layoutTags([
      { id: 'a', text: 'abc', x: 100, y: 50, w: 32, sortY: 98, headTop: 4 },
      { id: 'b', text: 'edge-tag', x: -10, y: 50, w: 32, sortY: 99, headTop: 4 },
    ]);
    expect(a).toEqual({ id: 'a', text: 'abc', x: Math.round(116 - tagWidth('abc') / 2), y: 54 - TAG_GAP - TAG_HEIGHT });
    expect(b?.x).toBe(0);
    expect(layoutTags([{ id: 'c', text: '', x: 0, y: 0, w: 32, sortY: 0, headTop: 0 }])).toEqual([]);
  });

  const snapshot = sample as unknown as Snapshot;
  for (const project of snapshot.projects) {
    it(`places the tags of room ${project.name} without overlaps, inside the scene`, () => {
      const scene = buildScene(snapshot, project.id);
      const byId = new Map(snapshot.characters.map((c) => [c.id, c]));
      const items = scene.items
        .filter((it) => it.kind === 'character')
        .map((it) => ({ ...it, text: truncateTag(tagText(byId.get(it.id) as Character)) }));
      const tags = tagsOf(items);
      expect(tags).toHaveLength(items.length);
      for (const t of tags) {
        expect(t.x).toBeGreaterThanOrEqual(0);
        expect(t.x + t.w).toBeLessThanOrEqual(SCENE_WIDTH);
        expect(t.y).toBeGreaterThanOrEqual(0);
      }
      expectNoOverlap(tags);
    });
  }

  it('places the gallery tags without overlaps', () => {
    const entries = galleryEntries(snapshot.characters).map((e) => ({ ...e, text: e.tag }));
    const tags = tagsOf(entries);
    expect(tags).toHaveLength(entries.length);
    expectNoOverlap(tags);
  });
});
