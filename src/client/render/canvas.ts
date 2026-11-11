// The office canvas: fixed 480x270 scene, scaled by whole numbers only.
import { SCENE_HEIGHT, SCENE_WIDTH } from '../../shared/constants.js';
import { colour } from './palette.js';

/** Clear colour: the palette's darkest night (also `--bg` in ui/shell.css). */
export const CLEAR_COLOUR = colour('night0');

/** Largest whole-number scale that fits; never below 1 (the stage scrolls). */
export function integerScale(availW: number, availH: number): number {
  return Math.max(1, Math.floor(Math.min(availW / SCENE_WIDTH, availH / SCENE_HEIGHT)));
}

/** Sizes the canvas to its container on every resize; returns a disposer. */
export function mountCanvas(canvas: HTMLCanvasElement, container: HTMLElement): () => void {
  canvas.width = SCENE_WIDTH;
  canvas.height = SCENE_HEIGHT;
  const ctx = canvas.getContext('2d');
  if (ctx) {
    ctx.imageSmoothingEnabled = false;
    ctx.fillStyle = CLEAR_COLOUR;
    ctx.fillRect(0, 0, SCENE_WIDTH, SCENE_HEIGHT);
  }

  const resize = (): void => {
    const scale = integerScale(container.clientWidth, container.clientHeight);
    canvas.style.width = `${String(SCENE_WIDTH * scale)}px`;
    canvas.style.height = `${String(SCENE_HEIGHT * scale)}px`;
    canvas.dataset['scale'] = String(scale);
  };

  const observer = new ResizeObserver(resize);
  observer.observe(container);
  resize();
  return () => {
    observer.disconnect();
  };
}
