// Live `prefers-reduced-motion` (UI-5): the store's `ui.reducedMotion` follows
// the media query, including changes while the page is open. The office reads
// it every frame (office/mount.ts).
import type { Store } from './store.js';

export const REDUCED_MOTION_QUERY = '(prefers-reduced-motion: reduce)';

/** The part of a MediaQueryList this module uses. */
export type MotionQuery = Pick<MediaQueryList, 'matches' | 'addEventListener' | 'removeEventListener'>;

/** `matchMedia(query)`, or null when `matchMedia` is missing or throws. */
export function safeMatchMedia(query: string): MotionQuery | null {
  try {
    const match = (globalThis as { matchMedia?: (q: string) => MediaQueryList }).matchMedia;
    return match === undefined ? null : match.call(globalThis, query);
  } catch {
    return null;
  }
}

export function mountMotion(store: Store, mql: MotionQuery | null = safeMatchMedia(REDUCED_MOTION_QUERY)): () => void {
  if (mql === null) return () => undefined;
  const sync = (): void => {
    if (store.getState().ui.reducedMotion !== mql.matches) store.setUi({ reducedMotion: mql.matches });
  };
  sync();
  mql.addEventListener('change', sync);
  return () => {
    mql.removeEventListener('change', sync);
  };
}
