import { describe, expect, it } from 'vitest';
import sampleJson from '../../../../fixtures/snapshots/sample.json';
import type { Activity, Character, Snapshot } from '../../../shared/types.js';
import { SPOTS, characterFrame, spot } from '../layout.js';
import { assignSeats } from '../seats.js';
import { actorFrame, planTargets, stepActors, syncActors, type Actor, type Target, type TargetCharacter } from './actors.js';
import { COUCH_AFTER_MS, WALK_FRAME_MS } from './constants.js';
import { buildGrid } from './grid.js';
import { pathLength } from './path.js';

const sample = sampleJson as unknown as Snapshot;
const HARBOR = '/home/demo/code/harbor';
const NOW = Date.parse(sample.generatedAt);
const grid = buildGrid();
const harbor = sample.characters.filter((c) => c.projectId === HARBOR);
const { seats } = assignSeats(harbor, SPOTS);
const seatOf = (id: string) => {
  const name = seats.get(id);
  return name === undefined ? undefined : spot(name);
};
const byName = (name: string): Character => {
  const c = harbor.find((x) => x.name === name);
  if (c === undefined) throw new Error(name);
  return c;
};
const interns = new Set(harbor.filter((c) => c.kind === 'agent').map((c) => c.id));

const iso = (ms: number): string => new Date(ms).toISOString();
const idler = (id: string, idleMs: number): TargetCharacter => ({ id, status: 'idle', lastActivityAt: iso(NOW - idleMs) });
const anySeat = () => spot('open-1');

describe('planTargets', () => {
  const targets = planTargets(harbor, seatOf, sample.activities, NOW);

  it('maps each status to its place and pose', () => {
    for (const c of harbor) {
      const t = targets.get(c.id);
      const seat = seatOf(c.id);
      expect(t, c.name).toBeDefined();
      if (c.status === 'busy' || c.status === 'waiting' || c.status === 'stopped') {
        expect(t?.spot).toBe(seat?.name);
        expect(t?.pose).toBe({ busy: 'sit', waiting: 'raiseHand', stopped: 'headDown' }[c.status]);
      }
      if (c.status === 'ended') expect([t?.spot, t?.pose]).toEqual(['door', 'stand']);
      if (c.status === 'idle') expect(['couch', 'coffee']).toContain(t?.pose);
    }
    expect(targets.get(byName('c05-plan').id)?.pose).toBe('raiseHand');
    expect(targets.get(byName('check-tests').id)?.pose).toBe('headDown');
    expect(targets.get(byName('quick-fix').id)?.spot).toBe('door');
  });

  it('takes the kind of the newest activity for busy characters', () => {
    for (const c of harbor.filter((x) => x.status === 'busy')) {
      const mine = sample.activities.filter((a) => a.characterId === c.id).sort((a, b) => Date.parse(b.at) - Date.parse(a.at));
      expect(targets.get(c.id)?.kind, c.name).toBe(mine[0]?.kind ?? 'write');
    }
    const lone: TargetCharacter = { id: 'lone', status: 'busy', lastActivityAt: null };
    expect(planTargets([lone], anySeat, [], NOW).get('lone')?.kind).toBe('write');
    const acts: Activity[] = [
      { characterId: 'lone', at: iso(NOW - 2000), tool: 'Bash', kind: 'shell', target: 'make' },
      { characterId: 'lone', at: iso(NOW - 1000), tool: 'WebFetch', kind: 'web', target: 'example.com' },
      { characterId: 'lone', at: iso(NOW - 3000), tool: 'Read', kind: 'read', target: 'a.ts' },
    ];
    expect(planTargets([lone], anySeat, acts, NOW).get('lone')?.kind).toBe('web');
    expect(targets.get(byName('c05-plan').id)?.kind).toBeNull();
  });

  it('sends long-idle characters to the couch by id, the rest to the kitchen', () => {
    // Both sample idlers are idle far longer than COUCH_AFTER_MS; owner-docs sorts first by id.
    expect(targets.get(byName('owner-docs').id)?.spot).toBe('couch-1');
    expect(targets.get(byName('c04-research').id)?.spot).toBe('couch-2');
    expect(targets.get(byName('owner-docs').id)?.seated).toBe(true);
    const fresh = planTargets(harbor, seatOf, sample.activities, null);
    expect(fresh.get(byName('owner-docs').id)?.spot).toBe('kitchen-1');
    expect(fresh.get(byName('c04-research').id)?.spot).toBe('kitchen-2');
  });

  it('keeps the third couch candidate in the kitchen', () => {
    const t = planTargets([idler('c', COUCH_AFTER_MS), idler('a', COUCH_AFTER_MS + 1), idler('b', 200_000)], anySeat, [], NOW);
    expect([t.get('a')?.spot, t.get('b')?.spot, t.get('c')?.spot]).toEqual(['couch-1', 'couch-2', 'kitchen-1']);
    expect(t.get('c')?.pose).toBe('coffee');
  });

  it('gives idle characters distinct kitchen spots until overflow', () => {
    const ids = ['f', 'e', 'd', 'c', 'b', 'a'];
    const t = planTargets(ids.map((id) => idler(id, 1000)), anySeat, [], NOW);
    expect(['a', 'b', 'c', 'd', 'e', 'f'].map((id) => t.get(id)?.spot)).toEqual([
      'kitchen-1',
      'kitchen-2',
      'kitchen-3',
      'kitchen-4',
      'kitchen-4',
      'kitchen-4',
    ]);
  });

  it('gives no target to characters without a seat', () => {
    expect(planTargets([idler('x', 0)], () => undefined, [], NOW).size).toBe(0);
  });
});

const at = (name: string, extra: Partial<Target> = {}): Target => {
  const s = spot(name);
  return { x: s.x, y: s.y, spot: s.name, seated: s.kind !== 'stand', pose: 'sit', kind: 'write', ...extra };
};
const only = (actors: Map<string, Actor>, id: string): Actor => {
  const a = actors.get(id);
  if (a === undefined) throw new Error(id);
  return a;
};
const walk = (a: Actor, dtMs: number, reduced = false): number => {
  let steps = 0;
  while (a.path.length > 0 && steps < 10_000) {
    stepActors(new Map([[a.id, a]]), dtMs, reduced);
    steps++;
  }
  return steps;
};

describe('syncActors and stepActors', () => {
  it('places everyone at their target on the first sync', () => {
    const targets = planTargets(harbor, seatOf, sample.activities, NOW);
    const actors = syncActors(new Map(), targets, interns, true, grid);
    expect(actors.size).toBe(targets.size);
    for (const [id, t] of targets) {
      const a = only(actors, id);
      expect([a.x, a.y, a.path.length]).toEqual([t.x, t.y, 0]);
      expect(a.gone).toBe(t.spot === 'door');
      expect(a.intern).toBe(interns.has(id));
    }
    expect(stepActors(actors, 16, false)).toBe(false);
  });

  it('walks a later arrival in from the door at 48 px/s', () => {
    const prev = syncActors(new Map(), new Map(), interns, true, grid);
    const actors = syncActors(prev, new Map([['n', at('B-lead')]]), interns, false, grid);
    const a = only(actors, 'n');
    expect([a.x, a.y]).toEqual([spot('door').x, spot('door').y]);
    const len = pathLength(a, a.path);
    expect(len).toBeGreaterThan(0);
    expect(walk(a, 100)).toBe(Math.ceil(len / 4.8));
    expect([a.x, a.y]).toEqual([spot('B-lead').x, spot('B-lead').y]);
    expect(a.walkedMs).toBeGreaterThan(0);
  });

  it('jumps to the target in one step with reduced motion', () => {
    const actors = syncActors(new Map(), new Map([['n', at('D-second')]]), new Set(), false, grid);
    const a = only(actors, 'n');
    expect(stepActors(actors, 16, true)).toBe(true);
    expect([a.x, a.y, a.path.length]).toEqual([spot('D-second').x, spot('D-second').y, 0]);
    expect(stepActors(actors, 16, true)).toBe(false);
  });

  it('walks a known actor to a changed target from where it is, keeps it on an unchanged one', () => {
    const first = syncActors(new Map(), new Map([['a', at('A-lead')]]), new Set(), true, grid);
    const same = syncActors(first, new Map([['a', at('A-lead', { kind: 'read' })]]), new Set(), false, grid);
    expect(only(same, 'a').path).toEqual([]);
    expect(only(same, 'a').target.kind).toBe('read');
    const moved = syncActors(same, new Map([['a', at('kitchen-2', { pose: 'coffee', kind: null })]]), new Set(), false, grid);
    const a = only(moved, 'a');
    expect([a.x, a.y]).toEqual([spot('A-lead').x, spot('A-lead').y]);
    expect(a.path.at(-1)).toEqual({ x: spot('kitchen-2').x, y: spot('kitchen-2').y });
    expect(syncActors(moved, new Map(), new Set(), false, grid).size).toBe(0);
  });

  it('marks an ended actor gone once it reaches the door', () => {
    const first = syncActors(new Map(), new Map([['a', at('C-lead')]]), new Set(), true, grid);
    const leaving = syncActors(first, new Map([['a', at('door', { pose: 'stand', kind: null })]]), new Set(), false, grid);
    const a = only(leaving, 'a');
    expect(a.gone).toBe(false);
    walk(a, 50);
    expect(a.gone).toBe(true);
    // Back again: walks in from the door.
    const back = only(syncActors(leaving, new Map([['a', at('C-lead')]]), new Set(), false, grid), 'a');
    expect([back.gone, back.x, back.y]).toEqual([false, spot('door').x, spot('door').y]);
  });
});

describe('actorFrame', () => {
  it('alternates 4 walk frames of 150 ms while walking', () => {
    const a = only(syncActors(new Map(), new Map([['n', at('D-lead')]]), new Set(), false, grid), 'n');
    const frames: (string | null)[] = [];
    for (let i = 0; i < 6; i++) {
      frames.push(actorFrame(a, 0, false).frame);
      stepActors(new Map([['n', a]]), WALK_FRAME_MS, false);
    }
    expect(frames).toEqual(['walk0', 'walk1', 'walk2', 'walk3', 'walk0', 'walk1']);
    const f = actorFrame(a, 0, false);
    expect([f.w, f.h, f.sortY]).toEqual([32, 48, a.y]);
    // Standing while walking: no seat drop.
    expect(f.y).toBe(a.y - 48);
  });

  it('matches the seated frame of buildScene once arrived', () => {
    for (const name of ['A-lead', 'cto', 'open-3', 'B-intern-1']) {
      const intern = name.includes('intern');
      const a = only(syncActors(new Map(), new Map([['n', at(name)]]), intern ? new Set(['n']) : new Set(), false, grid), 'n');
      walk(a, 100);
      const f = actorFrame(a, 0, false);
      expect({ x: f.x, y: f.y, w: f.w, h: f.h }, name).toEqual(characterFrame(spot(name), intern));
      expect([f.sortY, f.frame]).toEqual([spot(name).y, null]);
    }
  });

  it('never shows a walk frame with reduced motion', () => {
    const a = only(syncActors(new Map(), new Map([['n', at('kitchen-3')]]), new Set(), false, grid), 'n');
    expect(actorFrame(a, 0, true).frame).toBeNull();
  });

  it('shows head down at the desk and cheers while cheering', () => {
    const a = only(syncActors(new Map(), new Map([['n', at('A-second', { pose: 'headDown', kind: null })]]), new Set(), true, grid), 'n');
    expect(actorFrame(a, 0, false).frame).toBe('head');
    a.cheerUntil = 3000;
    expect([0, 250, 500].map((t) => actorFrame(a, t, false).frame)).toEqual(['cheer0', 'cheer1', 'cheer0']);
    expect(actorFrame(a, 250, true).frame).toBe('cheer0');
    expect(actorFrame(a, 3000, false).frame).toBe('head');
  });
});
