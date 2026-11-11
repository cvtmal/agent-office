// Context meters (research R7, OFFICE-5): fill = tokens / the role's last threshold
// (RECYCLE for teammates, HANDOVER for the CTO), capped at 1; sweat at RECYCLE and
// HANDOVER; no meter for ended characters. Colour is the caller's (`verdictHex`). DOM-free.
import { THRESHOLDS } from '../../../shared/constants.js';
import type { Character } from '../../../shared/types.js';

/** Meter fill 0-1 of a character. */
export function meterFill(c: Pick<Character, 'role' | 'tokens'>): number {
  const limit = c.role === 'cto' ? THRESHOLDS.cto.handover : THRESHOLDS.teammate.recycle;
  return Math.max(0, Math.min(1, c.tokens / limit));
}

/** Meter bar size in px: 16x3 above an agent, 12x2 above an intern. */
export function meterSize(intern: boolean): { w: number; h: number } {
  return intern ? { w: 12, h: 2 } : { w: 16, h: 3 };
}

/** True if the character gets a meter (everyone but the ended). */
export function showMeter(c: Pick<Character, 'status'>): boolean {
  return c.status !== 'ended';
}

/** True if the character sweats (verdict RECYCLE or HANDOVER). */
export function sweats(c: Pick<Character, 'verdict'>): boolean {
  return c.verdict === 'RECYCLE' || c.verdict === 'HANDOVER';
}
