import { describe, expect, it } from 'vitest';
import sampleJson from '../../../../fixtures/snapshots/sample.json';
import type { Character, Snapshot } from '../../../shared/types.js';
import { meterFill, meterSize, showMeter, sweats } from './meter.js';

const sample = sampleJson as unknown as Snapshot;
const byName = (name: string): Character => {
  const c = sample.characters.find((x) => x.name === name);
  if (c === undefined) throw new Error(name);
  return c;
};

describe('meterFill', () => {
  it('fills by the role last threshold, capped at 1', () => {
    expect(meterFill(byName('cto-2'))).toBe(1);
    expect(meterFill(byName('c06-review'))).toBe(1);
    expect(meterFill(byName('c04-research'))).toBeCloseTo(160 / 180);
    expect(meterFill(byName('c03-implement'))).toBeCloseTo(120 / 180);
    expect(meterFill({ role: 'cto', tokens: 125_000 })).toBeCloseTo(0.5);
    expect(meterFill({ role: 'teammate', tokens: 0 })).toBe(0);
  });
});

describe('meter flags', () => {
  it('sweats exactly at RECYCLE and HANDOVER', () => {
    for (const c of sample.characters) expect(sweats(c), c.name).toBe(c.verdict === 'RECYCLE' || c.verdict === 'HANDOVER');
    expect(sample.characters.filter(sweats).map((c) => c.name).sort()).toEqual(['c06-review', 'cto-2']);
  });

  it('shows no meter for ended characters', () => {
    for (const c of sample.characters) expect(showMeter(c), c.name).toBe(c.status !== 'ended');
    expect(showMeter(byName('quick-fix'))).toBe(false);
  });

  it('sizes the bar per frame', () => {
    expect(meterSize(false)).toEqual({ w: 16, h: 3 });
    expect(meterSize(true)).toEqual({ w: 12, h: 2 });
  });
});
