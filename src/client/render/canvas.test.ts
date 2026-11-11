import { describe, expect, it } from 'vitest';
import { integerScale } from './canvas.js';

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
