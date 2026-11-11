// Project tabs in #overview: one tab per project, shown only when there are at
// least two. A click selects the room through the store (ui.activeProjectId);
// the office resolves the same field with office/scene.ts `selectProject`.
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

export function mountTabs(el: HTMLElement, store: Store): () => void {
  const doc = el.ownerDocument;
  const nav = doc.createElement('nav');
  nav.className = 'tabs';
  nav.setAttribute('role', 'tablist');
  nav.setAttribute('aria-label', 'Projects');
  el.append(nav);

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
