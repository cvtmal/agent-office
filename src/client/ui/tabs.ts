// Project tabs in #overview: one tab per project, shown only when there are at
// least two. A click selects the room through the store (ui.activeProjectId);
// the office resolves the same field with office/scene.ts `selectProject`.
// Keyboard (UI-5, P-7): roving tabindex — Tab reaches the active tab, ArrowLeft /
// ArrowRight (wrapping), Home and End select and focus the others.
import type { Snapshot } from '../../shared/types.js';
import type { AppState, Store } from '../app/store.js';
import { selectProject } from '../office/scene.js';

export interface Tab {
  id: string;
  label: string;
  active: boolean;
}

export interface TabModel {
  visible: boolean;
  tabs: Tab[];
}

export function tabModel(snapshot: Snapshot | null, activeProjectId: string | null): TabModel {
  if (snapshot === null) return { visible: false, tabs: [] };
  const active = selectProject(snapshot, activeProjectId);
  const tabs = snapshot.projects.map((p) => ({ id: p.id, label: p.name, active: p.id === active?.id }));
  return { visible: tabs.length >= 2, tabs };
}

/** Keys the tablist handles. */
const TAB_KEYS = ['ArrowRight', 'ArrowLeft', 'Home', 'End'] as const;

/** The tab `key` moves to from `currentId` (ArrowRight/Left wrap), or null for another key or no tabs. */
export function nextTab(ids: readonly string[], currentId: string | null, key: string): string | null {
  if (ids.length === 0) return null;
  const at = currentId === null ? -1 : ids.indexOf(currentId);
  const n = ids.length;
  switch (key) {
    case 'ArrowRight':
      return ids[(at + 1) % n] ?? null;
    case 'ArrowLeft':
      return ids[at < 0 ? n - 1 : (at - 1 + n) % n] ?? null;
    case 'Home':
      return ids[0] ?? null;
    case 'End':
      return ids[n - 1] ?? null;
    default:
      return null;
  }
}

export function mountTabs(el: HTMLElement, store: Store): () => void {
  const doc = el.ownerDocument;
  const nav = doc.createElement('nav');
  nav.className = 'tabs';
  nav.setAttribute('role', 'tablist');
  nav.setAttribute('aria-label', 'Projects');
  el.append(nav);

  nav.addEventListener('keydown', (event) => {
    if (!(TAB_KEYS as readonly string[]).includes(event.key)) return;
    const state = store.getState();
    const { tabs } = tabModel(state.snapshot, state.ui.activeProjectId);
    const current = tabs.find((t) => t.active)?.id ?? null;
    const next = nextTab(
      tabs.map((t) => t.id),
      current,
      event.key,
    );
    if (next === null) return;
    event.preventDefault();
    store.setUi({ activeProjectId: next });
    // The store notifies synchronously, so the tabs are already re-rendered here.
    for (const child of nav.children) {
      if (child instanceof HTMLElement && child.dataset['projectId'] === next) child.focus();
    }
  });

  let key = '';
  const render = (state: AppState): void => {
    const model = tabModel(state.snapshot, state.ui.activeProjectId);
    const next = JSON.stringify(model);
    if (next === key) return;
    key = next;
    nav.hidden = !model.visible;
    nav.replaceChildren(
      ...model.tabs.map((tab) => {
        const button = doc.createElement('button');
        button.type = 'button';
        button.className = 'tab';
        button.setAttribute('role', 'tab');
        button.setAttribute('aria-selected', String(tab.active));
        button.setAttribute('aria-controls', 'stage');
        button.tabIndex = tab.active ? 0 : -1;
        button.dataset['projectId'] = tab.id;
        button.textContent = tab.label;
        button.addEventListener('click', () => {
          store.setUi({ activeProjectId: tab.id });
        });
        return button;
      }),
    );
  };
  render(store.getState());
  return store.subscribe(render);
}
