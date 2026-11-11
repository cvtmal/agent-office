// Tiny generated sounds (research R8, scope §7), off by default. The store's snapshot
// changes are diffed here (sound-events.ts) and played through Web Audio only while
// `ui.sound` is on and `ui.paused` is off; reduced motion does not mute. The audio
// context is made the first time `ui.sound` is on (normally inside the switch's click,
// so the browser lets it start) and is never referenced at module load.
import type { Snapshot } from '../../shared/types.js';
import { createGate, soundsFor, type SoundKind } from './sound-events.js';
import type { Store } from './store.js';

/** Loudest any sound gets. */
export const PEAK_GAIN = 0.15;

/** The parts of Web Audio this module uses (so tests can pass a fake). */
export interface AudioParamLike {
  setValueAtTime(value: number, time: number): unknown;
  linearRampToValueAtTime(value: number, time: number): unknown;
  exponentialRampToValueAtTime(value: number, time: number): unknown;
}
export interface AudioNodeLike {
  connect(destination: AudioNodeLike): unknown;
}
export interface GainNodeLike extends AudioNodeLike {
  gain: AudioParamLike;
}
export interface OscillatorNodeLike extends AudioNodeLike {
  type: string;
  frequency: AudioParamLike;
  start(when: number): void;
  stop(when: number): void;
}
export interface BiquadFilterNodeLike extends AudioNodeLike {
  type: string;
  frequency: AudioParamLike;
}
export interface AudioBufferLike {
  getChannelData(channel: number): Float32Array;
}
export interface AudioBufferSourceNodeLike extends AudioNodeLike {
  buffer: AudioBufferLike | null;
  start(when: number): void;
  stop(when: number): void;
}
export interface AudioContextLike {
  readonly currentTime: number;
  readonly sampleRate: number;
  readonly state: string;
  readonly destination: AudioNodeLike;
  createGain(): GainNodeLike;
  createOscillator(): OscillatorNodeLike;
  createBiquadFilter(): BiquadFilterNodeLike;
  createBuffer(channels: number, length: number, sampleRate: number): AudioBufferLike;
  createBufferSource(): AudioBufferSourceNodeLike;
  resume(): Promise<void>;
  close(): Promise<void>;
}

const TICK_S = 0.03;

/** A gain node with a short attack/decay envelope peaking at `peak` (clamped to PEAK_GAIN). */
function envelope(ctx: AudioContextLike, at: number, dur: number, peak: number): GainNodeLike {
  const g = ctx.createGain();
  g.gain.setValueAtTime(0, at);
  g.gain.linearRampToValueAtTime(Math.min(peak, PEAK_GAIN), at + 0.004);
  g.gain.exponentialRampToValueAtTime(0.0001, at + dur);
  g.connect(ctx.destination);
  return g;
}

function tone(ctx: AudioContextLike, type: string, hz: number, at: number, dur: number, peak: number): void {
  const osc = ctx.createOscillator();
  osc.type = type;
  osc.frequency.setValueAtTime(hz, at);
  osc.connect(envelope(ctx, at, dur, peak));
  osc.start(at);
  osc.stop(at + dur);
}

/** Plays one sound now on `ctx`; `noise` is a short white-noise buffer for the tick. */
function play(ctx: AudioContextLike, kind: SoundKind, noise: () => AudioBufferLike): void {
  const t = ctx.currentTime;
  if (kind === 'tick') {
    const src = ctx.createBufferSource();
    src.buffer = noise();
    const filter = ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.setValueAtTime(3200, t);
    src.connect(filter);
    filter.connect(envelope(ctx, t, TICK_S, 0.08));
    src.start(t);
    src.stop(t + TICK_S);
  } else if (kind === 'coffee') {
    tone(ctx, 'sine', 220, t, 0.07, 0.12);
    tone(ctx, 'sine', 165, t + 0.11, 0.07, 0.12);
  } else {
    [523.25, 659.25, 783.99].forEach((hz, i) => {
      tone(ctx, 'square', hz, t + i * 0.11, i === 2 ? 0.22 : 0.1, 0.06);
    });
  }
}

const now = (): number => performance.now();

/** Where the first user gesture is heard (the document); null means "already allowed". */
export interface GestureTarget {
  addEventListener(type: string, listener: () => void, options: { capture: boolean }): void;
  removeEventListener(type: string, listener: () => void, options: { capture: boolean }): void;
}

/** Events that give the page user activation, so an AudioContext may start. */
const GESTURES = ['pointerdown', 'keydown'] as const;

export function mountSound(
  store: Store,
  audio: () => AudioContextLike = () => new AudioContext(),
  gestures: GestureTarget | null = typeof document === 'undefined' ? null : document,
): () => void {
  let ctx: AudioContextLike | null = null;
  let failed = false;
  // A context made before any gesture starts suspended and warns (autoplay policy), e.g.
  // when the saved sound pref is on at page load: wait for the first gesture instead.
  let allowed = gestures === null;
  let noiseBuffer: AudioBufferLike | null = null;
  let prev: Snapshot | null = store.getState().snapshot;
  const gate = createGate();

  const noise = (): AudioBufferLike => {
    if (ctx === null) throw new Error('no audio context');
    if (noiseBuffer === null) {
      const length = Math.ceil(ctx.sampleRate * TICK_S);
      noiseBuffer = ctx.createBuffer(1, length, ctx.sampleRate);
      const data = noiseBuffer.getChannelData(0);
      for (let i = 0; i < length; i++) data[i] = Math.random() * 2 - 1;
    }
    return noiseBuffer;
  };

  const resume = (c: AudioContextLike): void => {
    if (c.state === 'suspended') c.resume().catch(() => undefined);
  };

  /** The context, made on first use; null when the browser has no Web Audio. */
  const context = (): AudioContextLike | null => {
    if (ctx === null && !failed && allowed) {
      try {
        ctx = audio();
      } catch {
        failed = true;
      }
    }
    return ctx;
  };

  const onState = (): void => {
    const { snapshot, ui } = store.getState();
    // Resuming on every state change while on covers a switch turned back on (a click).
    const c = ui.sound ? context() : null;
    if (c !== null) resume(c);
    if (snapshot === prev) return;
    const before = prev;
    prev = snapshot;
    if (c === null || ui.paused || snapshot === null) return;
    for (const kind of soundsFor(before, snapshot)) if (gate.allow(kind, now())) play(c, kind, noise);
  };

  const onGesture = (): void => {
    allowed = true;
    for (const type of GESTURES) gestures?.removeEventListener(type, onGesture, { capture: true });
    onState();
  };
  if (!allowed) for (const type of GESTURES) gestures?.addEventListener(type, onGesture, { capture: true });

  onState();
  const unsubscribe = store.subscribe(onState);
  return () => {
    unsubscribe();
    for (const type of GESTURES) gestures?.removeEventListener(type, onGesture, { capture: true });
    if (ctx !== null) ctx.close().catch(() => undefined);
    ctx = null;
  };
}
