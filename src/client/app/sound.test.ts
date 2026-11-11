import { describe, expect, it, vi } from 'vitest';
import sampleJson from '../../../fixtures/snapshots/sample.json';
import type { Activity, Snapshot } from '../../shared/types.js';
import { mountSound, PEAK_GAIN, type AudioContextLike } from './sound.js';
import { createStore } from './store.js';

const sample = sampleJson as unknown as Snapshot;

/** A fake AudioContext that records what is created, started and how loud gains get. */
function fakeAudio(initialState = 'suspended') {
  const started: { kind: string; type?: string }[] = [];
  const peaks: number[] = [];
  const param = () => ({
    setValueAtTime: (v: number) => peaks.push(v),
    linearRampToValueAtTime: (v: number) => peaks.push(v),
    exponentialRampToValueAtTime: (v: number) => peaks.push(v),
  });
  const node = () => ({ connect: () => undefined });
  const ctx = {
    currentTime: 0,
    sampleRate: 8000,
    state: initialState,
    destination: node(),
    resume: vi.fn(() => {
      ctx.state = 'running';
      return Promise.resolve();
    }),
    close: vi.fn(() => Promise.resolve()),
    createGain: () => ({ ...node(), gain: param() }),
    createBiquadFilter: () => ({ ...node(), type: 'lowpass', frequency: { ...param(), setValueAtTime: () => 0 } }),
    createBuffer: (_c: number, length: number) => {
      const data = new Float32Array(length);
      return { getChannelData: () => data };
    },
    createOscillator: () => {
      const osc = {
        ...node(),
        type: 'sine',
        frequency: { ...param(), setValueAtTime: () => 0 },
        start: () => started.push({ kind: 'osc', type: osc.type }),
        stop: () => undefined,
      };
      return osc;
    },
    createBufferSource: () => ({
      ...node(),
      buffer: null,
      start: () => started.push({ kind: 'noise' }),
      stop: () => undefined,
    }),
  };
  const factory = vi.fn(() => ctx as AudioContextLike);
  return { ctx, factory, started, peaks };
}

/** A document stand-in that records capture listeners and can fire them. */
function fakeDocument() {
  const listeners = new Map<string, () => void>();
  return {
    listeners,
    addEventListener: (type: string, listener: () => void) => listeners.set(type, listener),
    removeEventListener: (type: string, listener: () => void) => {
      if (listeners.get(type) === listener) listeners.delete(type);
    },
    fire: (type: string) => listeners.get(type)?.(),
  };
}

function withOutcome(base: Snapshot): Snapshot {
  return {
    ...base,
    projects: base.projects.map((p) =>
      p.harness === null ? p : { ...p, harness: { ...p.harness, outcomes: [...p.harness.outcomes, { nn: 90, slug: 'x' }] } },
    ),
  };
}

function withWrite(base: Snapshot): Snapshot {
  const a: Activity = { characterId: base.characters[0]?.id ?? '', at: '2026-11-11T23:59:00Z', tool: 'Write', kind: 'write', target: 'a.ts' };
  return { ...base, activities: [...base.activities, a] };
}

describe('mountSound', () => {
  it('never makes a context while the switch is off', () => {
    const store = createStore();
    const audio = fakeAudio();
    mountSound(store, audio.factory);
    store.applySnapshot(sample);
    store.applySnapshot(withOutcome(sample));
    store.setUi({ paused: true });
    expect(audio.factory).not.toHaveBeenCalled();
  });

  it('makes one context when the switch turns on and resumes it', () => {
    const store = createStore();
    const audio = fakeAudio();
    mountSound(store, audio.factory);
    store.setUi({ sound: true });
    expect(audio.factory).toHaveBeenCalledTimes(1);
    expect(audio.ctx.resume).toHaveBeenCalledTimes(1);
    store.setUi({ sound: false });
    store.setUi({ sound: true });
    store.applySnapshot(sample);
    expect(audio.factory).toHaveBeenCalledTimes(1);
  });

  it('makes the context at mount when the switch is already on and no gesture is needed', () => {
    const store = createStore();
    store.setUi({ sound: true });
    const audio = fakeAudio();
    mountSound(store, audio.factory, null);
    expect(audio.factory).toHaveBeenCalledTimes(1);
  });

  it('with saved prefs on, waits for the first gesture before making the context', () => {
    const store = createStore();
    store.setUi({ sound: true });
    const audio = fakeAudio();
    const doc = fakeDocument();
    const dispose = mountSound(store, audio.factory, doc);
    store.applySnapshot(sample);
    expect(audio.factory).not.toHaveBeenCalled();
    expect([...doc.listeners.keys()].sort()).toEqual(['keydown', 'pointerdown']);
    doc.fire('pointerdown');
    expect(audio.factory).toHaveBeenCalledTimes(1);
    expect(audio.ctx.resume).toHaveBeenCalledTimes(1);
    expect(doc.listeners.size).toBe(0);
    store.applySnapshot(withOutcome(sample));
    expect(audio.started.length).toBeGreaterThan(0);
    dispose();
  });

  it('removes the gesture listeners on dispose', () => {
    const store = createStore();
    const doc = fakeDocument();
    const dispose = mountSound(store, fakeAudio().factory, doc);
    expect(doc.listeners.size).toBe(2);
    dispose();
    expect(doc.listeners.size).toBe(0);
  });

  it('plays the fanfare (three square notes) for a new outcome, within the gain cap', () => {
    const store = createStore();
    const audio = fakeAudio();
    mountSound(store, audio.factory);
    store.applySnapshot(sample);
    store.setUi({ sound: true });
    store.applySnapshot(withOutcome(sample));
    expect(audio.started).toEqual([
      { kind: 'osc', type: 'square' },
      { kind: 'osc', type: 'square' },
      { kind: 'osc', type: 'square' },
    ]);
    expect(Math.max(...audio.peaks)).toBeLessThanOrEqual(PEAK_GAIN);
  });

  it('ticks with noise for a new write', () => {
    const store = createStore();
    const audio = fakeAudio();
    mountSound(store, audio.factory);
    store.setUi({ sound: true });
    store.applySnapshot(sample);
    store.applySnapshot(withWrite(sample));
    expect(audio.started).toEqual([{ kind: 'noise' }]);
  });

  it('is silent for the first snapshot and while paused', () => {
    const store = createStore();
    const audio = fakeAudio();
    mountSound(store, audio.factory);
    store.setUi({ sound: true, paused: true });
    store.applySnapshot(sample);
    store.applySnapshot(withOutcome(sample));
    expect(audio.started).toEqual([]);
  });

  it('is silent once the switch is off again, and does not replay missed changes', () => {
    const store = createStore();
    const audio = fakeAudio();
    mountSound(store, audio.factory);
    store.setUi({ sound: true });
    store.applySnapshot(sample);
    store.setUi({ sound: false });
    const next = withOutcome(sample);
    store.applySnapshot(next);
    store.setUi({ sound: true });
    expect(audio.started).toEqual([]);
  });

  it('plays with reduced motion on', () => {
    const store = createStore();
    const audio = fakeAudio();
    mountSound(store, audio.factory);
    store.setUi({ sound: true, reducedMotion: true });
    store.applySnapshot(sample);
    store.applySnapshot(withOutcome(sample));
    expect(audio.started).toHaveLength(3);
  });

  it('stays quiet when the browser has no Web Audio', () => {
    const store = createStore();
    const factory = vi.fn((): AudioContextLike => {
      throw new Error('no AudioContext');
    });
    mountSound(store, factory);
    store.setUi({ sound: true });
    store.applySnapshot(sample);
    store.applySnapshot(withOutcome(sample));
    expect(factory).toHaveBeenCalledTimes(1);
  });

  it('unsubscribes and closes the context on dispose', () => {
    const store = createStore();
    const audio = fakeAudio();
    const dispose = mountSound(store, audio.factory);
    store.setUi({ sound: true });
    store.applySnapshot(sample);
    dispose();
    expect(audio.ctx.close).toHaveBeenCalledTimes(1);
    store.applySnapshot(withOutcome(sample));
    expect(audio.started).toEqual([]);
  });
});
