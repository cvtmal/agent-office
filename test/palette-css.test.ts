import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { PALETTE } from '../src/client/render/palette.js';
import { VERDICT_COLOUR } from '../src/client/render/verdict-colour.js';
import { VERDICTS } from '../src/shared/constants.js';

const css = readFileSync(new URL('../src/client/ui/shell.css', import.meta.url), 'utf8');

/** Value of a CSS custom property declared in shell.css. */
function cssVar(name: string): string | undefined {
  return new RegExp(`--${name}:\\s*(#[0-9a-fA-F]{6})`).exec(css)?.[1]?.toLowerCase();
}

describe('ui/shell.css colours', () => {
  it('--bg equals the palette night0 (the canvas clear colour)', () => {
    expect(cssVar('bg')).toBe(PALETTE['night0']);
  });

  it('--panel, --border and --text are palette colours', () => {
    expect(cssVar('panel')).toBe(PALETTE['night1']);
    expect(cssVar('border')).toBe(PALETTE['lamp2']);
    expect(cssVar('text')).toBe(PALETTE['lamp2']);
  });

  it('--verdict-* equal the palette colours of VERDICT_COLOUR', () => {
    for (const v of VERDICTS) {
      expect(cssVar(`verdict-${v.toLowerCase()}`)).toBe(PALETTE[VERDICT_COLOUR[v]]);
    }
  });
});
