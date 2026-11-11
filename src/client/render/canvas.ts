// The office canvas: fixed 480x270 scene, scaled by whole numbers only.
import { SCENE_HEIGHT, SCENE_WIDTH } from '../../shared/constants.js';
import type { Store } from '../app/store.js';
import { colour } from './palette.js';

/** Clear colour: the palette's darkest night (also `--bg` in ui/shell.css). */
export const CLEAR_COLOUR = colour('night0');

/** Largest whole-number scale that fits; never below 1 (the stage scrolls). */
export function integerScale(availW: number, availH: number): number {
  return Math.max(1, Math.floor(Math.min(availW / SCENE_WIDTH, availH / SCENE_HEIGHT)));
}

/** The canvas scale: a fixed zoom step, or the largest whole-number fit when `zoom` is null. */
export function scaleFor(zoom: number | null, availW: number, availH: number): number {
  return zoom ?? integerScale(availW, availH);
}

/**
 * Sizes the canvas to its container on every resize; returns a disposer. With a
 * `store`, `ui.zoom` picks a fixed scale (null = fit) and a zoom change resizes.
 */
export function mountCanvas(canvas: HTMLCanvasElement, container: HTMLElement, store?: Store): () => void {
  canvas.width = SCENE_WIDTH;
  canvas.height = SCENE_HEIGHT;
  const ctx = canvas.getContext('2d');
  if (ctx) {
    ctx.imageSmoothingEnabled = false;
    ctx.fillStyle = CLEAR_COLOUR;
    ctx.fillRect(0, 0, SCENE_WIDTH, SCENE_HEIGHT);
  }

  const resize = (): void => {
    const zoom = store ? store.getState().ui.zoom : null;
    const scale = scaleFor(zoom, container.clientWidth, container.clientHeight);
    canvas.style.width = `${String(SCENE_WIDTH * scale)}px`;
    canvas.style.height = `${String(SCENE_HEIGHT * scale)}px`;
    canvas.dataset['scale'] = String(scale);
  };

  // Resizing inside the observer callback can trigger "ResizeObserver loop"
  // errors; defer it to the next frame, at most one pending.
  let frame: number | null = null;
  const observer = new ResizeObserver(() => {
    if (frame !== null) return;
    frame = requestAnimationFrame(() => {
      frame = null;
      resize();
    });
  });
  observer.observe(container);
  resize();

  let lastZoom = store?.getState().ui.zoom ?? null;
  const unsubscribe = store?.subscribe((state) => {
    if (state.ui.zoom === lastZoom) return;
    lastZoom = state.ui.zoom;
    resize();
  });
  return () => {
    observer.disconnect();
    if (frame !== null) cancelAnimationFrame(frame);
    unsubscribe?.();
  };
}
