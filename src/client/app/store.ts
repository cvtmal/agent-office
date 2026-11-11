// The client's one store. Every change replaces the state object and notifies
// listeners synchronously.
import type { Snapshot } from '../../shared/types.js';

/** Client-only (not part of the API contract): the state of the live connection. */
export type Connection = 'loading' | 'ready' | 'reconnecting' | 'error';

export interface UiState {
  selectedId: string | null;
  /** Project whose room is shown; null = the first project (see office/scene.ts `selectProject`). */
  activeProjectId: string | null;
  /** Fixed integer canvas scale (one of `ZOOM_STEPS`); null = fit the stage. */
  zoom: number | null;
  /** Freezes the office clock; the loop keeps drawing. */
  paused: boolean;
  /** Sound switch (off by default; no sounds play yet, #7). */
  sound: boolean;
  /** Ended characters are not drawn (they keep their seats). */
  hideEnded: boolean;
  /** Live `prefers-reduced-motion` (app/motion.ts); never saved. */
  reducedMotion: boolean;
}

/** Zoom steps offered by the controls (integer scales only). */
export const ZOOM_STEPS = [1, 2, 3, 4] as const;

export interface AppState {
  snapshot: Snapshot | null;
  connection: Connection;
  error: string | null;
  ui: UiState;
}

export type Listener = (state: AppState) => void;

export interface Store {
  getState(): AppState;
  subscribe(fn: Listener): () => void;
  applySnapshot(snapshot: Snapshot): void;
  setConnection(connection: Connection, error?: string): void;
  setUi(patch: Partial<UiState>): void;
}

export function initialState(): AppState {
  return {
    snapshot: null,
    connection: 'loading',
    error: null,
    ui: {
      selectedId: null,
      activeProjectId: null,
      zoom: null,
      paused: false,
      sound: false,
      hideEnded: false,
      reducedMotion: false,
    },
  };
}

export function createStore(initial: AppState = initialState()): Store {
  let state = initial;
  const listeners = new Set<Listener>();

  const set = (next: AppState): void => {
    state = next;
    for (const fn of [...listeners]) fn(state);
  };

  return {
    getState: () => state,
    subscribe(fn) {
      listeners.add(fn);
      return () => {
        listeners.delete(fn);
      };
    },
    // The single entry point for snapshot data: the sample load here, the live
    // stream (#3) and the renderer (#2) meet at this call.
    applySnapshot(snapshot) {
      set({ ...state, snapshot, connection: 'ready', error: null });
    },
    setConnection(connection, error) {
      set({ ...state, connection, error: error ?? null });
    },
    setUi(patch) {
      set({ ...state, ui: { ...state.ui, ...patch } });
    },
  };
}
