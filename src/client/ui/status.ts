// The overview line: character count or the error, and the connection state
// mirrored into #app[data-connection].
import type { AppState, Store } from '../app/store.js';

export function statusText(state: AppState): string {
  if (state.connection === 'error') return `Agent Office · ${state.error ?? 'error'}`;
  if (state.snapshot === null) return 'Agent Office · loading';
  return `Agent Office · ${String(state.snapshot.characters.length)} characters`;
}

export function mountStatus(el: HTMLElement, store: Store, app: HTMLElement | null = el.closest('#app')): () => void {
  const render = (state: AppState): void => {
    el.textContent = statusText(state);
    if (app) app.dataset['connection'] = state.connection;
  };
  render(store.getState());
  return store.subscribe(render);
}
