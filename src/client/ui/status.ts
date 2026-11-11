// The overview line: character count or the error, and the connection state
// mirrored into #app[data-connection] (and the snapshot's generatedAt into
// #app[data-generated-at], for the browser checks). Deltas keep generatedAt, so a
// per-character change shows in #app[data-last-activity-at]: the latest
// lastActivityAt across characters. Writes only into its own child
// <span class="status">, so the rest of #overview (project tabs) survives.
import type { AppState, Store } from '../app/store.js';

export function statusText(state: AppState): string {
  if (state.connection === 'error') return `Agent Office · ${state.error ?? 'error'}`;
  const reconnecting = state.connection === 'reconnecting';
  if (state.snapshot === null) return reconnecting ? 'Agent Office · reconnecting' : 'Agent Office · loading';
  const count = `Agent Office · ${String(state.snapshot.characters.length)} characters`;
  return reconnecting ? `${count} · reconnecting` : count;
}

/** The latest `lastActivityAt` across the snapshot's characters (ISO strings sort by time), or null. */
export function latestActivityAt(state: AppState): string | null {
  let latest: string | null = null;
  for (const c of state.snapshot?.characters ?? []) {
    if (c.lastActivityAt !== null && (latest === null || c.lastActivityAt > latest)) latest = c.lastActivityAt;
  }
  return latest;
}

export function mountStatus(el: HTMLElement, store: Store, app: HTMLElement | null = el.closest('#app')): () => void {
  const span = el.ownerDocument.createElement('span');
  span.className = 'status';
  el.append(span);
  const render = (state: AppState): void => {
    span.textContent = statusText(state);
    if (app) {
      app.dataset['connection'] = state.connection;
      if (state.snapshot !== null) app.dataset['generatedAt'] = state.snapshot.generatedAt;
      const latest = latestActivityAt(state);
      if (latest !== null) app.dataset['lastActivityAt'] = latest;
      else delete app.dataset['lastActivityAt'];
    }
  };
  render(store.getState());
  return store.subscribe(render);
}
