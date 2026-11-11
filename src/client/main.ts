// Client entry: one store, one mount call per part of the page, then the
// live connection (its first event is the snapshot).
import '@fontsource/pixelify-sans/400.css';
import './ui/shell.css';
import { connectLive } from './app/live.js';
import { mountMotion } from './app/motion.js';
import { mountPrefs } from './app/prefs.js';
import { mountSound } from './app/sound.js';
import { createStore } from './app/store.js';
import { mountOffice } from './office/mount.js';
import { mountCanvas } from './render/canvas.js';
import { mountControls } from './ui/controls.js';
import { mountHotspots } from './ui/hotspots.js';
import { mountInspector } from './ui/inspector.js';
import { mountStatus } from './ui/status.js';
import { mountStrip } from './ui/strip.js';
import { mountTabs } from './ui/tabs.js';

function byId<T extends HTMLElement>(id: string): T {
  const el = document.getElementById(id);
  if (!el) throw new Error(`#${id} missing from index.html`);
  return el as T;
}

const store = createStore();

// Later cycles append one mount call each.
mountCanvas(byId<HTMLCanvasElement>('office'), byId('stage'), store);
mountStatus(byId('overview'), store);
mountOffice(byId<HTMLCanvasElement>('office'), store);
mountTabs(byId('overview'), store);

connectLive(store);
mountPrefs(store);
mountMotion(store);
mountHotspots(byId('room'), byId<HTMLCanvasElement>('office'), store);
mountStrip(byId('overview'), store);
mountControls(byId('overview'), store);
mountInspector(byId('inspector'), store);
mountSound(store);
