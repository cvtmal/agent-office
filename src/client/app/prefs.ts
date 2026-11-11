// Remembered controls (UI-3): zoom, pause, sound, hide ended and the active
// project are kept in localStorage. Every storage access is wrapped in
// try/catch: a private window or blocked site data must never break the page.
// `selectedId` and `reducedMotion` are never saved.
import { ZOOM_STEPS, type AppState, type Store, type UiState } from './store.js';

export const PREFS_KEY = 'agent-office:prefs';

/** Format version of the stored JSON; anything else is ignored. */
const VERSION = 1;

export type Prefs = Pick<UiState, 'zoom' | 'paused' | 'sound' | 'hideEnded' | 'activeProjectId'>;

const BOOLEAN_KEYS = ['paused', 'sound', 'hideEnded'] as const;

function isZoom(value: unknown): value is number | null {
  return value === null || (ZOOM_STEPS as readonly unknown[]).includes(value);
}

/** Valid fields of a stored prefs string; invalid JSON, a wrong `v` or a bad field is dropped. */
export function parsePrefs(raw: string | null): Partial<Prefs> {
  if (raw === null) return {};
  let data: unknown;
  try {
    data = JSON.parse(raw);
  } catch {
    return {};
  }
  if (typeof data !== 'object' || data === null) return {};
  const record = data as Record<string, unknown>;
  if (record['v'] !== VERSION) return {};
  const out: Partial<Prefs> = {};
  const zoom = record['zoom'];
  if (isZoom(zoom)) out.zoom = zoom;
  for (const key of BOOLEAN_KEYS) {
    const value = record[key];
    if (typeof value === 'boolean') out[key] = value;
  }
  const project = record['activeProjectId'];
  if (project === null || typeof project === 'string') out.activeProjectId = project;
  return out;
}

/** The saved fields of `ui`, serialised with the format version. */
export function serialisePrefs(ui: UiState): string {
  const prefs: Prefs & { v: number } = {
    v: VERSION,
    zoom: ui.zoom,
    paused: ui.paused,
    sound: ui.sound,
    hideEnded: ui.hideEnded,
    activeProjectId: ui.activeProjectId,
  };
  return JSON.stringify(prefs);
}

export function loadPrefs(storage: Pick<Storage, 'getItem'> | null): Partial<Prefs> {
  if (storage === null) return {};
  try {
    return parsePrefs(storage.getItem(PREFS_KEY));
  } catch {
    return {};
  }
}

export function savePrefs(storage: Pick<Storage, 'setItem'> | null, ui: UiState): void {
  if (storage === null) return;
  try {
    storage.setItem(PREFS_KEY, serialisePrefs(ui));
  } catch {
    // Quota or blocked storage: the prefs simply are not remembered.
  }
}

/** `globalThis.localStorage`, or null when it is missing or its accessor throws. */
export function safeLocalStorage(): Storage | null {
  try {
    return (globalThis as { localStorage?: Storage }).localStorage ?? null;
  } catch {
    return null;
  }
}

/** Applies the stored prefs with one `setUi`, then saves whenever the saved fields change. */
export function mountPrefs(
  store: Store,
  storage: Pick<Storage, 'getItem' | 'setItem'> | null = safeLocalStorage(),
): () => void {
  const loaded = loadPrefs(storage);
  if (Object.keys(loaded).length > 0) store.setUi(loaded);
  let last = serialisePrefs(store.getState().ui);
  return store.subscribe((state: AppState) => {
    const next = serialisePrefs(state.ui);
    if (next === last) return;
    last = next;
    savePrefs(storage, state.ui);
  });
}
