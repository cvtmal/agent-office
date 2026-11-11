import { describe, expect, it } from 'vitest';
import sampleJson from '../../../fixtures/snapshots/sample.json';
import type { Activity, Snapshot } from '../../shared/types.js';
import { initialState, type UiState } from '../app/store.js';
import { ageText, cardModel, clock, detailBlock, NONE } from './inspector.js';

const sample = sampleJson as unknown as Snapshot;
const NOW = Date.parse(sample.generatedAt);
const NOTES = '/home/demo/code/notes-app';
const byName = (name: string) => {
  const c = sample.characters.find((x) => x.name === name);
  if (c === undefined) throw new Error(`no ${name} in the sample`);
  return c;
};
const ui = (patch: Partial<UiState>): UiState => ({ ...initialState().ui, ...patch });

describe('cardModel', () => {
  it('is null without a selection or snapshot', () => {
    expect(cardModel(sample, ui({}), NOW)).toBeNull();
    expect(cardModel(null, ui({ selectedId: byName('cto-2').id }), NOW)).toBeNull();
    expect(cardModel(sample, ui({ selectedId: 'gone' }), NOW)).toBeNull();
  });

  it('shows the CTO as the fixture has it', () => {
    const cto = byName('cto-2');
    const card = cardModel(sample, ui({ selectedId: cto.id }), NOW);
    expect(card).toMatchObject({
      id: cto.id,
      name: 'cto-2',
      kind: cto.kind,
      role: 'cto',
      project: 'harbor',
      lane: NONE,
      status: cto.status,
      tokens: cto.tokens,
      verdict: cto.verdict,
      barPct: 100,
      age: '1m ago',
      ageIso: cto.lastActivityAt,
      where: cto.where,
      branch: cto.gitBranch,
      agentType: null,
    });
    const own = sample.activities.filter((a) => a.characterId === cto.id);
    expect(card?.activities).toHaveLength(Math.min(10, own.length));
  });

  it('formats the lane and scales the bar by the teammate recycle threshold', () => {
    const c = byName('c03-implement');
    const card = cardModel(sample, ui({ selectedId: c.id }), NOW);
    expect(card?.lane).toBe('A · live-updates · :8001');
    expect(card?.barPct).toBe(Math.round((c.tokens / 180_000) * 100));
  });

  it('lists the newest activities first, at most 10', () => {
    const c = byName('c03-implement');
    const many: Activity[] = Array.from({ length: 14 }, (_, i) => ({
      characterId: c.id,
      at: new Date(NOW - (14 - i) * 60_000).toISOString(),
      tool: 'Read',
      kind: 'read',
      target: `f${String(i)}.ts`,
    }));
    const snapshot: Snapshot = { ...sample, activities: [...many, ...sample.activities] };
    const card = cardModel(snapshot, ui({ selectedId: c.id }), NOW);
    expect(card?.activities).toHaveLength(10);
    expect(card?.activities[0]?.target).toBe('f13.ts');
    const times = card?.activities.map((a) => Date.parse(a.at)) ?? [];
    expect([...times].sort((a, b) => b - a)).toEqual(times);
    expect(card?.activities[0]?.clock).toBe(clock(card?.activities[0]?.at ?? ''));
  });

  it('copies an activity detail (detail mode) and has no detail key without one', () => {
    const c = byName('c03-implement');
    const base = { characterId: c.id, tool: 'Bash', kind: 'shell' as const, target: 'git' };
    const withDetail: Activity = { ...base, at: new Date(NOW - 60_000).toISOString(), detail: '{"command":"git status"}' };
    const without: Activity = { ...base, at: new Date(NOW - 120_000).toISOString() };
    const snapshot: Snapshot = { ...sample, activities: [without, withDetail] };
    const rows = cardModel(snapshot, ui({ selectedId: c.id }), NOW)?.activities ?? [];
    expect(rows[0]?.detail).toBe('{"command":"git status"}');
    expect(rows[1]).toBeDefined();
    expect(Object.keys(rows[1] ?? {})).not.toContain('detail');
  });

  it('is null for an ended character while hide ended is on', () => {
    const ended = byName('quick-fix');
    expect(cardModel(sample, ui({ selectedId: ended.id }), NOW)?.status).toBe('ended');
    expect(cardModel(sample, ui({ selectedId: ended.id, hideEnded: true }), NOW)).toBeNull();
  });

  it('is null for a character of another project', () => {
    const notes = byName('notes-ui');
    expect(cardModel(sample, ui({ selectedId: notes.id }), NOW)).toBeNull();
    expect(cardModel(sample, ui({ selectedId: notes.id, activeProjectId: NOTES }), NOW)?.project).toBe('notes-app');
  });

  it('shows "—" for an age without times', () => {
    const cto = byName('cto-2');
    const snapshot: Snapshot = {
      ...sample,
      characters: sample.characters.map((c) => (c.id === cto.id ? { ...c, lastActivityAt: null, lastUsageAt: null } : c)),
    };
    expect(cardModel(snapshot, ui({ selectedId: cto.id }), NOW)).toMatchObject({ age: NONE, ageIso: null });
  });
});

describe('ageText', () => {
  it.each([
    [59_000, '59s ago'],
    [4 * 60_000, '4m ago'],
    [3 * 3_600_000, '3h ago'],
    [2 * 86_400_000, '2d ago'],
    [-5_000, '0s ago'],
  ])('%i ms -> %s', (ms, text) => {
    expect(ageText(ms)).toBe(text);
  });
});

/** A stand-in for `document.createElement` (the unit tests run without a DOM); it parses no markup. */
interface FakeNode {
  tagName: string;
  className: string;
  textContent: string | null;
  children: FakeNode[];
}
const fakeDoc = {
  createElement(tag: string): FakeNode {
    const node = {
      tagName: tag.toUpperCase(),
      className: '',
      textContent: null as string | null,
      children: [] as FakeNode[],
      append(...nodes: FakeNode[]) {
        node.children.push(...nodes);
      },
    };
    return node;
  },
} as unknown as Pick<Document, 'createElement'>;

describe('detailBlock', () => {
  it('puts the detail into details > pre as text; markup stays text', () => {
    const detail = '{"command":"echo <b>bold</b>"}';
    const block = detailBlock(fakeDoc, detail) as unknown as FakeNode | null;
    expect(block?.tagName).toBe('DETAILS');
    expect(block?.children.map((n) => n.tagName)).toEqual(['SUMMARY', 'PRE']);
    expect(block?.children[0]?.textContent).toBe('input');
    const pre = block?.children[1];
    expect(pre?.textContent).toBe(detail);
    expect(pre?.children).toEqual([]);
  });

  it('is null without a detail', () => {
    expect(detailBlock(fakeDoc, undefined)).toBeNull();
  });
});

describe('clock', () => {
  it('is local HH:MM', () => {
    const iso = '2026-11-11T08:05:00Z';
    const d = new Date(iso);
    const expected = `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
    expect(clock(iso)).toBe(expected);
    expect(clock(iso)).toMatch(/^\d\d:\d\d$/);
  });
});
