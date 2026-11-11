import { describe, expect, it } from 'vitest';
import { roleFor, verdictFor } from './verdict.js';

describe('verdictFor', () => {
  it.each([
    [149_999, 'OK'],
    [150_000, 'WARN'],
    [179_999, 'WARN'],
    [180_000, 'RECYCLE'],
  ] as const)('teammate at %i tokens is %s', (tokens, verdict) => {
    expect(verdictFor(tokens, 'teammate')).toBe(verdict);
  });

  it.each([
    [219_999, 'OK'],
    [220_000, 'WARN'],
    [249_999, 'WARN'],
    [250_000, 'HANDOVER'],
  ] as const)('cto at %i tokens is %s', (tokens, verdict) => {
    expect(verdictFor(tokens, 'cto')).toBe(verdict);
  });

  it('uses the thresholds passed in', () => {
    const thresholds = { teammate: { warn: 10, recycle: 20 }, cto: { warn: 30, handover: 40 } };
    expect(verdictFor(10, 'teammate', thresholds)).toBe('WARN');
    expect(verdictFor(40, 'cto', thresholds)).toBe('HANDOVER');
  });
});

describe('roleFor', () => {
  it('a session named CTO-3 is the cto', () => {
    expect(roleFor('session', 'CTO-3')).toBe('cto');
  });

  it('an agent named cto-x is a teammate', () => {
    expect(roleFor('agent', 'cto-x')).toBe('teammate');
  });

  it('any other session is a teammate', () => {
    expect(roleFor('session', 'c03-implement')).toBe('teammate');
  });
});
