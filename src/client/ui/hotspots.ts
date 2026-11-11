// The hotspot layer (R1, R2, UI-5): one transparent <button> per drawn character
// over the canvas, inside the positioned #room. `mountOffice` announces the drawn
// boxes with `LAYOUT_EVENT`; the buttons are placed in percent of the 480x270
// scene (P-6), so zoom and resize need no wiring. Native buttons give Tab order,
// Enter and Space; a click selects the character (the inspector opens).
// `hotspotModel` is pure; the DOM mount renders it.
import { SCENE_HEIGHT, SCENE_WIDTH } from '../../shared/constants.js';
import type { Snapshot } from '../../shared/types.js';
import type { AppState, Store } from '../app/store.js';
import { LAYOUT_EVENT, type CharacterBox } from '../office/boxes.js';

export interface Hotspot {
  id: string;
  /** `<name>, <status>`. */
  label: string;
  selected: boolean;
  /** Box in percent of the scene. */
  left: number;
  top: number;
  width: number;
  height: number;
}

/** One hotspot per box whose character is in the snapshot, in box order (unknown ids dropped). */
export function hotspotModel(
  boxes: readonly CharacterBox[],
  snapshot: Snapshot | null,
  selectedId: string | null,
): Hotspot[] {
  if (snapshot === null) return [];
  const byId = new Map(snapshot.characters.map((c) => [c.id, c]));
  return boxes.flatMap((box) => {
    const c = byId.get(box.id);
    if (c === undefined) return [];
    return [
      {
        id: box.id,
        label: `${c.name}, ${c.status}`,
        selected: box.id === selectedId,
        left: (box.x / SCENE_WIDTH) * 100,
        top: (box.y / SCENE_HEIGHT) * 100,
        width: (box.w / SCENE_WIDTH) * 100,
        height: (box.h / SCENE_HEIGHT) * 100,
      },
    ];
  });
}

export function mountHotspots(room: HTMLElement, canvas: HTMLCanvasElement, store: Store): () => void {
  const doc = room.ownerDocument;
  const layer = doc.createElement('div');
  layer.className = 'hotspots';
  room.append(layer);

  let boxes: readonly CharacterBox[] = [];
  let key = '';
  const render = (state: AppState): void => {
    const model = hotspotModel(boxes, state.snapshot, state.ui.selectedId);
    const next = JSON.stringify(model);
    if (next === key) return;
    key = next;
    // Keep keyboard focus on the same character across re-renders.
    const active = doc.activeElement;
    const focusedId = active instanceof HTMLElement && layer.contains(active) ? (active.dataset['characterId'] ?? null) : null;
    layer.replaceChildren(
      ...model.map((spot) => {
        const button = doc.createElement('button');
        button.type = 'button';
        button.className = 'hotspot';
        button.dataset['characterId'] = spot.id;
        button.setAttribute('aria-label', spot.label);
        button.setAttribute('aria-expanded', String(spot.selected));
        button.setAttribute('aria-controls', 'inspector');
        button.style.left = `${String(spot.left)}%`;
        button.style.top = `${String(spot.top)}%`;
        button.style.width = `${String(spot.width)}%`;
        button.style.height = `${String(spot.height)}%`;
        button.addEventListener('click', () => {
          store.setUi({ selectedId: spot.id });
        });
        return button;
      }),
    );
    if (focusedId === null) return;
    for (const child of layer.children) {
      if (child instanceof HTMLElement && child.dataset['characterId'] === focusedId) child.focus();
    }
  };

  const onLayout = (event: Event): void => {
    boxes = (event as CustomEvent<CharacterBox[]>).detail;
    render(store.getState());
  };
  canvas.addEventListener(LAYOUT_EVENT, onLayout);
  render(store.getState());
  const unsubscribe = store.subscribe(render);
  return () => {
    unsubscribe();
    canvas.removeEventListener(LAYOUT_EVENT, onLayout);
    layer.remove();
  };
}
