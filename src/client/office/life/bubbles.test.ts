import { describe, expect, it } from 'vitest';
import sampleJson from '../../../../fixtures/snapshots/sample.json';
import type { Activity, Snapshot } from '../../../shared/types.js';
import { bubbleText, createBubbles, newActivities } from './bubbles.js';
import { BUBBLE_GLYPHS, BUBBLE_SHOW_MS } from './constants.js';

const sample = sampleJson as unknown as Snapshot;
const act = (i: number, characterId = 'c1', target = `file-${String(i)}.ts`): Activity => ({
  characterId,
  at: new Date(Date.UTC(2026, 10, 11, 9, 0, 0, i)).toISOString(),
  tool: i % 2 === 0 ? 'Read' : 'Grep',
  kind: 'read',
  target,
});
const glyphs = (s: string): number => [...s].length;

describe('newActivities', () => {
  it('gives none for the first snapshot', () => {
    expect(newActivities(null, sample)).toEqual([]);
  });

  it('gives only activities not seen before', () => {
    const extra = act(1, sample.characters[0]?.id ?? 'x');
    const next: Snapshot = { ...sample, activities: [...sample.activities, extra] };
    expect(newActivities(sample, next)).toEqual([extra]);
    expect(newActivities(next, next)).toEqual([]);
  });
});

describe('bubbleText', () => {
  it('fits targets into 16 glyphs with an ellipsis and a counter', () => {
    expect(bubbleText('a.ts', 1)).toBe('a.ts');
    expect(bubbleText('a.ts', 3)).toBe('a.ts x3');
    expect(bubbleText('sixteen-glyphs.x', 1)).toBe('sixteen-glyphs.x');
    expect(bubbleText('a-very-long-file-name.ts', 1)).toBe('a-very-long-fil…');
    expect(bubbleText('a-very-long-file-name.ts', 12)).toBe('a-very-long… x12');
    for (const t of ['', 'x', 'a-very-long-file-name.ts', 'ünïcødé-fïlé-nämé.ts']) {
      for (const n of [1, 2, 99, 1000]) expect(glyphs(bubbleText(t, n))).toBeLessThanOrEqual(BUBBLE_GLYPHS);
    }
  });
});

describe('createBubbles', () => {
  it('coalesces 20 calls in 2 s into one readable bubble with at most 3 changes', () => {
    const b = createBubbles();
    const contents: string[] = [];
    let last = '';
    for (let ms = 0; ms <= 6000; ms += 10) {
      if (ms < 2000 && ms % 100 === 0) b.push(act(ms / 100, 'c1', `src/some/long/path-${String(ms / 100)}.ts`), ms);
      b.step(ms);
      const vis = b.visible(ms);
      expect(vis.filter((x) => x.characterId === 'c1').length).toBeLessThanOrEqual(1);
      const now = vis[0] === undefined ? '' : `${vis[0].text}#${String(vis[0].count)}`;
      if (now !== last && now !== '') contents.push(now);
      last = now;
    }
    expect(contents.length).toBeLessThanOrEqual(3);
    const final = contents.at(-1) ?? '';
    const text = final.slice(0, final.lastIndexOf('#'));
    expect(glyphs(text)).toBeLessThanOrEqual(BUBBLE_GLYPHS);
    expect(text).toMatch(/ x\d+$/);
  });

  it('hides a bubble 3 s after its last change', () => {
    const b = createBubbles();
    b.push(act(1), 0);
    expect(b.visible(BUBBLE_SHOW_MS - 1)).toHaveLength(1);
    expect(b.visible(BUBBLE_SHOW_MS)).toHaveLength(0);
    b.push(act(2), 1500);
    b.step(1500);
    expect(b.visible(1500 + BUBBLE_SHOW_MS - 1)[0]?.text).toBe('file-2.ts');
    b.step(1500 + BUBBLE_SHOW_MS);
    expect(b.visible(1500 + BUBBLE_SHOW_MS)).toEqual([]);
  });

  it('keeps one bubble per character, uses the tool for an empty target', () => {
    const b = createBubbles();
    b.push(act(1, 'c2'), 0);
    b.push({ ...act(2, 'c1'), target: '', tool: 'TodoWrite', kind: 'plan' }, 0);
    expect(b.visible(10)).toEqual([
      { characterId: 'c1', kind: 'plan', text: 'TodoWrite', count: 1 },
      { characterId: 'c2', kind: 'read', text: 'file-1.ts', count: 1 },
    ]);
  });

  it('shows the newest held call at the next allowed change', () => {
    const b = createBubbles();
    b.push(act(1), 0);
    b.push(act(2), 300);
    b.push(act(3), 600);
    b.step(999);
    expect(b.visible(999)[0]?.text).toBe('file-1.ts');
    b.step(1000);
    expect(b.visible(1000)[0]).toMatchObject({ text: 'file-3.ts x2', count: 2 });
  });
});
