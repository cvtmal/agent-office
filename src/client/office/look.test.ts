import { describe, expect, it } from 'vitest';
import sampleJson from '../../../fixtures/snapshots/sample.json';
import type { Snapshot } from '../../shared/types.js';
import { AGENT_SPACE, INTERN_SPACE, LOOK_FIELDS } from '../sprites/characters/space.js';
import { lookFor, lookKey } from './look.js';

const sample = sampleJson as unknown as Snapshot;
const looks = sample.characters.map((c) => ({ c, look: lookFor(c.id, c.kind === 'agent') }));

describe('lookFor', () => {
  it('is a pure function of the id', () => {
    for (const { c, look } of looks) expect(lookFor(c.id, c.kind === 'agent')).toEqual(look);
  });

  it('pins cto-2: build 3, palette 4, hair 1', () => {
    const cto = looks.find(({ c }) => c.name === 'cto-2');
    expect(cto?.look).toMatchObject({ build: 3, palette: 4, hair: 1, intern: false });
  });

  it('keeps every field inside its look space', () => {
    for (const { look } of looks) {
      const space = look.intern ? INTERN_SPACE : AGENT_SPACE;
      for (const f of LOOK_FIELDS) {
        expect(Number.isInteger(look[f])).toBe(true);
        expect(look[f]).toBeGreaterThanOrEqual(0);
        expect(look[f]).toBeLessThan(space[f]);
      }
    }
  });

  it('gives the 14 sample characters 14 distinct look keys', () => {
    expect(new Set(looks.map(({ look }) => lookKey(look))).size).toBe(14);
  });

  it('gives distinct (build, palette, hair) within each sample room', () => {
    for (const p of sample.projects) {
      const room = looks.filter(({ c }) => c.projectId === p.id);
      const tuples = room.map(({ look }) => `${look.intern ? 'i' : 'a'}${String(look.build)}.${String(look.palette)}.${String(look.hair)}`);
      expect(new Set(tuples).size).toBe(room.length);
    }
  });
});

describe('lookKey', () => {
  it('separates interns from agents with equal indices', () => {
    const a = lookFor('x', false);
    expect(lookKey(a)).not.toBe(lookKey({ ...a, intern: true }));
    expect(lookKey(a)).toMatch(/^a:(\d+\.){7}\d+$/);
  });
});
