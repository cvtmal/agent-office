import { describe, expect, it } from 'vitest';
import sampleJson from '../../../fixtures/snapshots/sample.json';
import type { Snapshot } from '../../shared/types.js';
import { WHITEBOARD_TEXT } from './layout.js';
import { backgroundProps, buildScene, compareItems, selectProject, wallContent, wallKey, wallTextRaster } from './scene.js';
import { NEON, NERD } from './theme.js';

const sample = sampleJson as unknown as Snapshot;
const HARBOR = '/home/demo/code/harbor';
const NOTES = '/home/demo/code/notes-app';
const idOf = (name: string): string => sample.characters.find((c) => c.name === name)?.id ?? '';

describe('selectProject', () => {
  it('picks the active project, else the first', () => {
    expect(selectProject(sample, NOTES)?.name).toBe('notes-app');
    expect(selectProject(sample, null)?.name).toBe('harbor');
    expect(selectProject(sample, '/home/demo/code/gone')?.name).toBe('harbor');
    expect(selectProject({ ...sample, projects: [] }, null)).toBeNull();
  });
});

describe('buildScene', () => {
  const harbor = buildScene(sample, HARBOR);
  const notes = buildScene(sample, NOTES);
  const chars = (s: typeof harbor) => s.items.filter((i) => i.kind === 'character');

  it('draws 9 characters in harbor and 5 in notes-app, all seated', () => {
    expect(chars(harbor)).toHaveLength(9);
    expect(chars(notes)).toHaveLength(5);
    expect(harbor.overflow).toEqual([]);
    expect(harbor.project?.name).toBe('harbor');
    expect(harbor.theme).toBe(NERD);
    expect(notes.theme).toBe(NEON);
    expect(harbor.seats.get(idOf('cto-2'))).toBe('cto');
  });

  it('falls back to the first project for a missing id', () => {
    expect(buildScene(sample, null).project?.name).toBe('harbor');
    expect(chars(buildScene(sample, 'nope'))).toHaveLength(9);
  });

  it('sorts items by sortY, x, id, with a desk front after its seated character', () => {
    for (let i = 1; i < harbor.items.length; i++) {
      const a = harbor.items[i - 1];
      const b = harbor.items[i];
      if (a !== undefined && b !== undefined) expect(compareItems(a, b)).toBeLessThanOrEqual(0);
    }
    const index = (id: string): number => harbor.items.findIndex((i) => i.id === id);
    expect(index('desk:A-lead')).toBeGreaterThan(index(idOf('c03-implement')));
    expect(index('chair:A-lead')).toBeLessThan(index(idOf('c03-implement')));
    expect(index('desk:cto')).toBeGreaterThan(index(idOf('cto-2')));
  });

  it('lights occupied non-ended desks only, coffee and moon always', () => {
    const l = harbor.lamps;
    for (const id of ['lamp:cto', 'glow:cto', 'lamp:A-lead', 'glow:D-lead', 'lamp:open-1']) expect(l.has(id), id).toBe(true);
    expect(l.has('lamp:open-2')).toBe(false); // quick-fix has ended
    expect(l.has('lamp:A-second')).toBe(false);
    expect(l.has('lamp:coffee')).toBe(true);
    expect(l.has('moon:window')).toBe(true);
    expect(notes.lamps.has('lamp:open-3')).toBe(false); // notes-migrate has ended
    expect(notes.lamps.has('lamp:cto')).toBe(false);
    // Theme lights: the neon room's sign and fairy lights are always on; the nerd room has none.
    expect(notes.lamps.has('neon:sign')).toBe(true);
    expect(notes.lamps.has('neon:fairy')).toBe(true);
    expect(l.has('neon:sign')).toBe(false);
  });

  it('turns monitors of unlit desks off', () => {
    const sprite = (id: string): string | undefined => harbor.items.find((i) => i.id === id)?.sprite;
    expect(sprite('monitor:A-lead')).toBe('monitor');
    expect(sprite('monitor:open-2')).toBe('monitor-off');
    expect(sprite('monitor:B-second')).toBe('monitor-off-l'); // second desks use the mirrored monitor
  });

  it('keeps seats sticky across rebuilds', () => {
    const moved = new Map(harbor.seats);
    moved.set(idOf('owner-docs'), 'open-5');
    expect(buildScene(sample, HARBOR, moved).seats.get(idOf('owner-docs'))).toBe('open-5');
  });
});

describe('backgroundProps', () => {
  it('applies theme swaps and hides empty slots', () => {
    const nerd = backgroundProps(NERD);
    const neon = backgroundProps(NEON);
    expect(nerd.find((p) => p.id === 'wall-string')).toBeUndefined();
    expect(neon.find((p) => p.id === 'wall-string')?.sprite).toBe('fairy-lights');
    expect(neon.find((p) => p.id === 'wall-deco-2')?.sprite).toBe('neon-sign');
    expect(nerd.find((p) => p.id === 'whiteboard')?.sprite).toBe('whiteboard');
  });
});

describe('wallContent', () => {
  const harbor = selectProject(sample, HARBOR);
  const wall = wallContent(harbor);

  it('writes the wave and the CTO generation on the whiteboard', () => {
    expect(wall?.texts.map((t) => t.text)).toEqual(['W2', 'CTO 2']);
    const [wave, cto] = wall?.texts ?? [];
    expect(wave?.x).toBe(WHITEBOARD_TEXT.x);
    expect(cto?.box.x).toBeGreaterThan((wave?.box.x ?? 0) + (wave?.box.w ?? 0)); // boxes do not touch
  });

  it('fills one frame per outcome (3 in harbor) with its nn, the rest empty', () => {
    const frames = wall?.frames ?? [];
    expect(frames).toHaveLength(12);
    const filled = frames.filter((f) => f.sprite === 'done-frame');
    expect(filled).toHaveLength(3);
    expect(filled.map((f) => f.label?.text)).toEqual(['00', '01', '02']);
    expect(filled.map((f) => f.slot)).toEqual(['done-1', 'done-2', 'done-3']);
    expect(frames.slice(3).every((f) => f.sprite === 'done-frame-empty' && f.label === undefined)).toBe(true);
    for (const f of filled) {
      const box = f.label?.box;
      // Inside the certificate (x 2-13, y 2-9 of the frame).
      expect(box !== undefined && box.x > f.x + 1 && box.x + box.w <= f.x + 14 && box.y + box.h <= f.y + 10).toBe(true);
    }
  });

  it('keeps the last 12 outcomes by cycle number and skips missing fields', () => {
    if (harbor?.harness == null) throw new Error('harbor has no harness');
    const outcomes = Array.from({ length: 14 }, (_, i) => ({ nn: 13 - i, slug: `c${String(i)}` }));
    const many = wallContent({ ...harbor, harness: { ...harbor.harness, outcomes, wave: null, ctoGeneration: null } });
    expect(many?.texts).toEqual([]);
    expect(many?.frames.map((f) => f.label?.text)).toEqual(['02', '03', '04', '05', '06', '07', '08', '09', '10', '11', '12', '13']);
  });

  it('draws nothing for a non-harness room', () => {
    expect(wallContent(selectProject(sample, NOTES))).toBeNull();
    expect(wallContent(null)).toBeNull();
    expect(wallKey(null)).toBe('');
  });

  it('rasterises a text as its paper box and keys the content', () => {
    const t = wall?.texts[1];
    if (t === undefined) throw new Error('no CTO text');
    const r = wallTextRaster(t);
    expect([r.w, r.h]).toEqual([t.box.w, t.box.h]);
    expect(wallKey(wall)).toBe('W2|CTO 2|00|01|02|-|-|-|-|-|-|-|-|-');
  });
});
