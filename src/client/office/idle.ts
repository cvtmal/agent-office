// Idle animation clock (plan P-10): 4 frames of 450 ms (rest, breathe, rest, blink),
// each character offset by a hashed phase so a room does not breathe in step. DOM-free.
import { fnv1a } from '../render/hash.js';

/** Frames per idle cycle: 0 rest, 1 breathe, 2 rest, 3 blink. */
export const IDLE_FRAMES = 4;

/** Duration of one idle frame in ms. */
export const IDLE_FRAME_MS = 450;

/** Idle frame (0-3) of character `id` at `timeMs`; always 0 with reduced motion. */
export function idleFrame(timeMs: number, id: string, reduced: boolean): number {
  if (reduced) return 0;
  const step = Math.floor(timeMs / IDLE_FRAME_MS) + (fnv1a(`${id}:idle`) % IDLE_FRAMES);
  return ((step % IDLE_FRAMES) + IDLE_FRAMES) % IDLE_FRAMES;
}
