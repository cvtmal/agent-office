// One verdict -> colour map (P-3), shared by the inspector bar, the overview
// strip and #5's context meters. Mirrored as `--verdict-*` vars in
// ui/shell.css (test/palette-css.test.ts keeps both in sync).
import type { Verdict } from '../../shared/constants.js';
import { colour } from './palette.js';

export const VERDICT_COLOUR: Readonly<Record<Verdict, string>> = {
  OK: 'green1',
  WARN: 'lamp1',
  RECYCLE: 'orange1',
  HANDOVER: 'magenta1',
};

/** `#rrggbb` of a verdict's palette colour. */
export function verdictHex(v: Verdict): string {
  return colour(VERDICT_COLOUR[v]);
}
