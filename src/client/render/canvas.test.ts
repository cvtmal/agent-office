import { describe, expect, it } from 'vitest';
import { CLEAR_COLOUR, integerScale, scaleFor } from './canvas.js';
import { colour } from './palette.js';

describe('integerScale', () => {
  it.each([
    [480, 270, 1],
    [1280, 800, 2],
    [1919, 1080, 3],
    [300, 200, 1],
  ])('%i x %i -> %i', (w, h, scale) => {
    expect(integerScale(w, h)).toBe(scale);
  });
});

describe('scaleFor', () => {
  it('fits with zoom null', () => {
    expect(scaleFor(null, 1000, 600)).toBe(2);
  });

  it('uses a fixed zoom step regardless of the room', () => {
    expect(scaleFor(3, 100, 100)).toBe(3);
  });
});

describe('CLEAR_COLOUR', () => {
  it('is the palette night0', () => {
    expect(CLEAR_COLOUR).toBe(colour('night0'));
  });
});
