import { describe, expect, it } from 'vitest';
import { ACTIVITY_KINDS, type ActivityKind } from '../../../shared/constants.js';
import { SPOTS, spot } from '../layout.js';
import type { Actor, Pose } from './actors.js';
import { LIFE_IDS } from '../art-ids.js';
import { FOLDER_MS } from './constants.js';
import { deskAnchor, overlaysFor } from './overlays.js';

const actorAt = (name: string, pose: Pose, kind: ActivityKind | null, extra: Partial<Actor> = {}): Actor => {
  const s = spot(name);
  return {
    id: 'a',
    intern: false,
    x: s.x,
    y: s.y,
    path: [],
    target: { x: s.x, y: s.y, spot: name, seated: true, pose, kind },
    walkedMs: 0,
    gone: false,
    cheerUntil: 0,
    ...extra,
  };
};
const noIntern = (): undefined => undefined;
const sprites = (a: Actor, t = 0, reduced = false, intern = noIntern): string[] =>
  overlaysFor(a, t, reduced, intern).map((o) => o.sprite);

const EXPECTED: Record<ActivityKind, string> = {
  read: LIFE_IDS.papers,
  write: LIFE_IDS.hands[0],
  shell: LIFE_IDS.terminal,
  web: LIFE_IDS.globe,
  delegate: LIFE_IDS.folder,
  plan: LIFE_IDS.sticky,
  other: LIFE_IDS.hands[0],
};

describe('deskAnchor', () => {
  it('exists for every seat with a desk, and only those', () => {
    for (const s of SPOTS) {
      const hasDesk = s.kind === 'desk' || s.kind === 'cto' || s.kind === 'open';
      expect(deskAnchor(s) !== undefined, s.name).toBe(hasDesk);
    }
  });

  it('puts the papers on the side away from the monitor', () => {
    for (const name of ['A-lead', 'A-second', 'cto']) {
      const a = deskAnchor(spot(name));
      const s = spot(name);
      expect(Math.sign((a?.desk.x ?? 0) + 5 - s.x), name).toBe(-Math.sign((a?.monitor.x ?? 0) + 7 - s.x));
    }
  });
});

describe('overlaysFor', () => {
  it('draws one overlay set per busy kind at every desk seat', () => {
    for (const name of ['cto', 'A-lead', 'B-second', 'open-4']) {
      for (const kind of ACTIVITY_KINDS) {
        expect(sprites(actorAt(name, 'sit', kind)), `${name} ${kind}`).toEqual([EXPECTED[kind]]);
      }
    }
  });

  it('draws the raised hand, the coffee mug with steam, nothing on the couch or head down', () => {
    expect(sprites(actorAt('C-lead', 'raiseHand', null))).toEqual([LIFE_IDS.hand]);
    expect(sprites(actorAt('kitchen-1', 'coffee', null))).toEqual([LIFE_IDS.mug, LIFE_IDS.steam[0]]);
    expect(sprites(actorAt('couch-1', 'couch', null))).toEqual([]);
    expect(sprites(actorAt('D-lead', 'headDown', null))).toEqual([]);
    // No desk: no busy overlay.
    expect(sprites(actorAt('stand-1', 'sit', 'read'))).toEqual([]);
  });

  it('draws nothing while walking or gone', () => {
    expect(sprites(actorAt('A-lead', 'sit', 'read', { y: spot('A-lead').y + 20, path: [spot('A-lead')] }))).toEqual([]);
    expect(sprites(actorAt('door', 'stand', null, { gone: true }))).toEqual([]);
  });

  it('animates two-frame overlays and keeps frame 0 with reduced motion', () => {
    const typing = actorAt('A-lead', 'sit', 'write');
    const seen = new Set<string>();
    const reduced = new Set<string>();
    for (let t = 0; t < 1000; t += 50) {
      seen.add(sprites(typing, t)[0] ?? '');
      reduced.add(sprites(typing, t, true)[0] ?? '');
      reduced.add(sprites(actorAt('kitchen-2', 'coffee', null), t, true)[1] ?? '');
    }
    expect([...seen].sort()).toEqual([...LIFE_IDS.hands]);
    expect([...reduced].sort()).toEqual([LIFE_IDS.hands[0], LIFE_IDS.steam[0]]);
  });

  it('moves the folder to the intern spot, looping; parks it there with reduced motion', () => {
    const delegating = actorAt('A-lead', 'sit', 'delegate');
    const intern = (): ReturnType<typeof spot> => spot('A-intern-1');
    const pos = (t: number, reduced = false): [number, number] => {
      const o = overlaysFor(delegating, t, reduced, intern)[0];
      return [o?.x ?? NaN, o?.y ?? NaN];
    };
    const start = pos(0);
    expect(start).toEqual([deskAnchor(spot('A-lead'))?.desk.x, deskAnchor(spot('A-lead'))?.desk.y]);
    expect(pos(FOLDER_MS / 2)).not.toEqual(start);
    expect(pos(FOLDER_MS)).toEqual(start);
    expect(pos(0, true)).toEqual(pos(FOLDER_MS / 2, true));
    expect(pos(0, true)).toEqual([spot('A-intern-1').x - 4, spot('A-intern-1').y - 16]);
    // Without an intern the folder stays at the desk edge.
    expect(overlaysFor(delegating, 500, false, noIntern)[0]).toMatchObject({ x: start[0], y: start[1] });
  });
});
