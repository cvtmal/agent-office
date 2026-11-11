// The controls in #overview (UI-3, R6, R7): zoom steps Fit / 1x-4x and the
// toggles pause, sound (app/sound.ts plays it, #7) and hide ended. Each is
// a <button aria-pressed> with `data-control`; app/prefs.ts saves the state. The
// buttons are built once and only their state is updated, so focus stays put.
import type { AppState, Store, UiState } from '../app/store.js';
import { ZOOM_STEPS } from '../app/store.js';

type Toggle = 'paused' | 'sound' | 'hideEnded';

export function mountControls(el: HTMLElement, store: Store): () => void {
  const doc = el.ownerDocument;
  const root = doc.createElement('div');
  root.className = 'controls';

  const button = (control: string, label: string, onClick: () => void): HTMLButtonElement => {
    const b = doc.createElement('button');
    b.type = 'button';
    b.className = 'control';
    b.dataset['control'] = control;
    b.textContent = label;
    b.addEventListener('click', onClick);
    return b;
  };

  const zoomGroup = doc.createElement('div');
  zoomGroup.className = 'zoom';
  zoomGroup.setAttribute('role', 'group');
  zoomGroup.setAttribute('aria-label', 'Zoom');
  const zooms: [number | null, HTMLButtonElement][] = [null, ...ZOOM_STEPS].map((zoom) => [
    zoom,
    button(zoom === null ? 'zoom-fit' : `zoom-${String(zoom)}`, zoom === null ? 'Fit' : `${String(zoom)}×`, () => {
      store.setUi({ zoom });
    }),
  ]);
  zoomGroup.append(...zooms.map(([, b]) => b));

  const toggle = (field: Toggle, control: string, label: string): [Toggle, HTMLButtonElement] => [
    field,
    button(control, label, () => {
      store.setUi({ [field]: !store.getState().ui[field] } as Partial<UiState>);
    }),
  ];
  const toggles = [
    toggle('paused', 'pause', 'Pause animations'),
    toggle('sound', 'sound', 'Sound off'),
    toggle('hideEnded', 'hide-ended', 'Hide ended'),
  ];
  root.append(zoomGroup, ...toggles.map(([, b]) => b));
  el.append(root);

  let key = '';
  const render = (state: AppState): void => {
    const { zoom, paused, sound, hideEnded } = state.ui;
    const next = JSON.stringify([zoom, paused, sound, hideEnded]);
    if (next === key) return;
    key = next;
    for (const [step, b] of zooms) b.setAttribute('aria-pressed', String(zoom === step));
    for (const [field, b] of toggles) {
      b.setAttribute('aria-pressed', String(state.ui[field]));
      if (field === 'sound') b.textContent = state.ui.sound ? 'Sound on' : 'Sound off';
    }
  };
  render(store.getState());
  return store.subscribe(render);
}
