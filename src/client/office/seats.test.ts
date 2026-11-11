import { describe, expect, it } from 'vitest';
import sampleJson from '../../../fixtures/snapshots/sample.json';
import type { LaneLetter } from '../../shared/constants.js';
import type { Snapshot } from '../../shared/types.js';
import { SPOTS, spot } from './layout.js';
import { assignSeats, type SeatCharacter } from './seats.js';

const sample = sampleJson as unknown as Snapshot;
const HARBOR = '/home/demo/code/harbor';
const NOTES = '/home/demo/code/notes-app';
const room = (projectId: string): SeatCharacter[] => sample.characters.filter((c) => c.projectId === projectId);
const seatsByName = (projectId: string): Record<string, string | undefined> => {
  const { seats } = assignSeats(room(projectId), SPOTS);
  return Object.fromEntries(sample.characters.filter((c) => c.projectId === projectId).map((c) => [c.name, seats.get(c.id)]));
};

/** A synthetic session (`lane` letter optional) or agent (`parent` set). */
function mk(
  id: string,
  opts: { lane?: LaneLetter; parent?: string; ended?: boolean; at?: string; cto?: boolean } = {},
): SeatCharacter {
  return {
    id,
    kind: opts.parent === undefined ? 'session' : 'agent',
    role: opts.cto === true ? 'cto' : 'teammate',
    status: opts.ended === true ? 'ended' : 'busy',
    lane: opts.lane === undefined ? null : { slug: `lane-${opts.lane}`, letter: opts.lane, port: 8001 },
    parentId: opts.parent ?? null,
    lastActivityAt: opts.at ?? '2026-11-11T08:00:00Z',
  };
}

describe('assignSeats with the sample', () => {
  it('seats harbor: CTO in the corner office, teammates at their lane leads, interns beside them', () => {
    const s = seatsByName(HARBOR);
    expect(s['cto-2']).toBe('cto');
    expect([s['c03-implement'], s['c04-research'], s['c05-plan'], s['c06-review']]).toEqual([
      'A-lead',
      'B-lead',
      'C-lead',
      'D-lead',
    ]);
    expect(s['explore-imports']).toBe('A-intern-1');
    expect(s['check-tests']).toBe('D-intern-1');
    expect(s['owner-docs']).toBe('open-1');
    expect(s['quick-fix']).toBe('open-2');
    expect(assignSeats(room(HARBOR), SPOTS).overflow).toEqual([]);
  });

  it('seats notes-app: 3 sessions on open desks, both interns beside their parents', () => {
    const s = seatsByName(NOTES);
    expect(s['notes-search']).toBe('open-1');
    expect(s['notes-ui']).toBe('open-2');
    expect(s['notes-migrate']).toBe('open-3');
    for (const [intern, parent] of [
      ['find-index', 'notes-search'],
      ['rename-files', 'notes-migrate'],
    ] as const) {
      const seat = s[intern] ?? '';
      expect(seat).toMatch(/^open-intern-/);
      expect(spot(seat).desk).toBe(s[parent]);
    }
  });
});

describe('assignSeats rules', () => {
  it('puts two sessions of one lane at lead (newest) and second', () => {
    const { seats } = assignSeats(
      [mk('old', { lane: 'B', at: '2026-11-11T07:00:00Z' }), mk('new', { lane: 'B', at: '2026-11-11T08:00:00Z' })],
      SPOTS,
    );
    expect(seats.get('new')).toBe('B-lead');
    expect(seats.get('old')).toBe('B-second');
  });

  it('sends a third session of a lane to the open area', () => {
    const chars = ['a', 'b', 'c'].map((id, i) => mk(id, { lane: 'C', at: `2026-11-11T0${String(i + 5)}:00:00Z` }));
    const { seats } = assignSeats(chars, SPOTS);
    expect(seats.get('c')).toBe('C-lead');
    expect(seats.get('b')).toBe('C-second');
    expect(seats.get('a')).toBe('open-1');
  });

  it('sends a second CTO-role session to the open area', () => {
    const { seats } = assignSeats(
      [mk('cto-old', { cto: true, at: '2026-11-11T07:00:00Z' }), mk('cto-new', { cto: true, at: '2026-11-11T08:00:00Z' })],
      SPOTS,
    );
    expect(seats.get('cto-new')).toBe('cto');
    expect(seats.get('cto-old')).toBe('open-1');
  });

  it('lists characters without a free spot as overflow', () => {
    const spots = [spot('cto'), spot('open-1'), spot('open-intern-1')];
    const chars = [mk('s1'), mk('s2', { at: '2026-11-11T07:00:00Z' }), mk('a1', { parent: 's1' }), mk('a2', { parent: 's1' })];
    const { seats, overflow } = assignSeats(chars, spots);
    expect(seats.get('s1')).toBe('open-1');
    expect(seats.get('a1')).toBe('open-intern-1');
    expect(overflow.sort()).toEqual(['a2', 's2']);
  });

  it('falls back to the nearest free intern or stand spot', () => {
    const chars = [mk('p', { lane: 'A' }), mk('i1', { parent: 'p' }), mk('i2', { parent: 'p' }), mk('i3', { parent: 'p' })];
    const { seats } = assignSeats(chars, SPOTS);
    expect(new Set([seats.get('i1'), seats.get('i2')])).toEqual(new Set(['A-intern-1', 'A-intern-2']));
    expect(seats.get('i3')).toBe('C-intern-1'); // 70 px below A-lead; B-intern-1 is 84 px away
  });

  it('keeps previous seats that are still valid', () => {
    const chars = [mk('x', { lane: 'A' }), mk('y', { lane: 'A', at: '2026-11-11T09:00:00Z' }), mk('z')];
    const previous = new Map([
      ['x', 'A-lead'],
      ['z', 'open-4'],
      ['gone', 'open-1'],
      ['y', 'D-lead'], // no longer valid for lane A
    ]);
    const { seats } = assignSeats(chars, SPOTS, previous);
    expect(seats.get('x')).toBe('A-lead');
    expect(seats.get('y')).toBe('A-second');
    expect(seats.get('z')).toBe('open-4');
  });

  it('never lets an ended character displace a live one', () => {
    const chars = [mk('dead', { lane: 'A', ended: true, at: '2026-11-11T09:00:00Z' }), mk('live', { lane: 'A' })];
    const { seats } = assignSeats(chars, SPOTS, new Map([['dead', 'A-lead']]));
    expect(seats.get('live')).toBe('A-lead');
    expect(seats.get('dead')).toBe('A-second');

    const open = assignSeats([mk('gone', { ended: true }), mk('here')], SPOTS, new Map([['gone', 'open-1']]));
    expect(open.seats.get('here')).toBe('open-1');
    expect(open.seats.get('gone')).toBe('open-2');
  });

  it('is deterministic: shuffled input gives the same seats', () => {
    const chars = sample.characters as SeatCharacter[];
    const once = assignSeats(chars, SPOTS);
    for (const k of [1, 5, 7]) {
      const shuffled = [...chars].sort((a, b) => ((a.id.charCodeAt(k) * 31) % 17) - ((b.id.charCodeAt(k) * 31) % 17));
      const again = assignSeats(shuffled, SPOTS);
      expect([...again.seats].sort()).toEqual([...once.seats].sort());
      expect(again.overflow).toEqual(once.overflow);
    }
    expect([...assignSeats([...chars].reverse(), SPOTS).seats].sort()).toEqual([...once.seats].sort());
  });
});
