import {
  CTO_NAME_PATTERN,
  THRESHOLDS,
  type CharacterKind,
  type Role,
  type Verdict,
} from './constants.js';

/** Token thresholds per role, shaped like THRESHOLDS. */
export interface Thresholds {
  teammate: { warn: number; recycle: number };
  cto: { warn: number; handover: number };
}

/** The verdict for a token count under a role's thresholds (limits are inclusive). */
export function verdictFor(tokens: number, role: Role, thresholds: Thresholds = THRESHOLDS): Verdict {
  if (role === 'cto') {
    if (tokens >= thresholds.cto.handover) return 'HANDOVER';
    if (tokens >= thresholds.cto.warn) return 'WARN';
    return 'OK';
  }
  if (tokens >= thresholds.teammate.recycle) return 'RECYCLE';
  if (tokens >= thresholds.teammate.warn) return 'WARN';
  return 'OK';
}

/** The role of a character: a session whose name starts with `cto` is the CTO. */
export function roleFor(kind: CharacterKind, name: string): Role {
  return kind === 'session' && CTO_NAME_PATTERN.test(name) ? 'cto' : 'teammate';
}
