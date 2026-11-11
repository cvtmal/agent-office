// Client entry: one store, one mount call per part of the page, then the
// first snapshot load.
import '@fontsource/pixelify-sans/400.css';
import './ui/shell.css';
import { loadSnapshot } from './app/api.js';
import { createStore } from './app/store.js';
import { mountCanvas } from './render/canvas.js';
import { mountStatus } from './ui/status.js';

function byId<T extends HTMLElement>(id: string): T {
  const el = document.getElementById(id);
  if (!el) throw new Error(`#${id} missing from index.html`);
  return el as T;
}

const store = createStore();

// Later cycles append one mount call each.
mountCanvas(byId<HTMLCanvasElement>('office'), byId('stage'));
mountStatus(byId('overview'), store);

void loadSnapshot(store);
