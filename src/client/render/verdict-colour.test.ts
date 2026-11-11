import { describe, expect, it } from 'vitest';
import { VERDICTS } from '../../shared/constants.js';
import { PALETTE } from './palette.js';
import { VERDICT_COLOUR, verdictHex } from './verdict-colour.js';

describe('verdict colours', () => {
  it('maps every verdict to a palette colour', () => {
    expect(Object.keys(VERDICT_COLOUR).sort()).toEqual([...VERDICTS].sort());
    for (const v of VERDICTS) expect(PALETTE[VERDICT_COLOUR[v]]).toBeDefined();
  });

  it('verdictHex returns the palette hex', () => {
    expect(verdictHex('OK')).toBe(PALETTE['green1']);
    expect(verdictHex('WARN')).toBe(PALETTE['lamp1']);
    expect(verdictHex('RECYCLE')).toBe(PALETTE['orange1']);
    expect(verdictHex('HANDOVER')).toBe(PALETTE['magenta1']);
  });

  it('gives each verdict its own colour', () => {
    expect(new Set(VERDICTS.map(verdictHex)).size).toBe(VERDICTS.length);
  });
});
