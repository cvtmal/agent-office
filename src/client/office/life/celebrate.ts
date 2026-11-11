// Celebration (research R8, OFFICE-7): a new outcome on a harness project's done wall
// gets confetti over the wall and a cheering character (the lane's live character, else
// the CTO). Confetti is seeded, so the same outcome always falls the same way. DOM-free.
import type { Snapshot } from '../../../shared/types.js';
import { fnv1a } from '../../render/hash.js';
import { PLANNED_SPRITES, PROPS, spriteSize, type Rect } from '../layout.js';
import { ART_COLOURS } from '../art-ids.js';
import { CONFETTI_COUNT, CONFETTI_GRAVITY, CONFETTI_MS } from './constants.js';

/** An outcome that appeared since the previous snapshot. */
export interface NewOutcome {
  projectId: string;
  nn: number;
  slug: string;
}

/** One confetti particle: start point, velocity (px/s), wobble rate and palette colour. */
export interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  spin: number;
  colour: string;
  startMs: number;
}

/** A particle's position at some time. */
export interface ParticleAt {
  x: number;
  y: number;
  colour: string;
}

const key = (o: { nn: number; slug: string }): string => `${String(o.nn)}-${o.slug}`;

/**
 * Outcomes in `next` that a project did not have in `prev`, per project. None when `prev`
 * is null, and none for a project `prev` had no harness state for (no history).
 */
export function newOutcomes(prev: Snapshot | null, next: Snapshot): NewOutcome[] {
  if (prev === null) return [];
  const before = new Map(prev.projects.map((p) => [p.id, p.harness]));
  const out: NewOutcome[] = [];
  for (const p of next.projects) {
    const old = before.get(p.id);
    if (old === undefined || old === null || p.harness === null) continue;
    const seen = new Set(old.outcomes.map(key));
    for (const o of p.harness.outcomes) if (!seen.has(key(o))) out.push({ projectId: p.id, nn: o.nn, slug: o.slug });
  }
  return out;
}

const byId = (a: { id: string }, b: { id: string }): number => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0);

/** Who cheers for `slug`: the live character of that lane (sessions first), else the live CTO, else null. */
export function cheererFor(snapshot: Snapshot, projectId: string, slug: string): string | null {
  const live = snapshot.characters.filter((c) => c.projectId === projectId && c.status !== 'ended').sort(byId);
  const lane = live.filter((c) => c.lane?.slug === slug);
  const pick = lane.find((c) => c.kind === 'session') ?? lane[0] ?? live.find((c) => c.role === 'cto');
  return pick?.id ?? null;
}

/** Bounding box of the done wall's frames (`done-<n>` prop slots). */
export function doneWallArea(): Rect {
  const frames = PROPS.filter((p) => /^done-\d+$/.test(p.slot));
  let x0 = Infinity;
  let y0 = Infinity;
  let x1 = -Infinity;
  let y1 = -Infinity;
  for (const p of frames) {
    const planned = PLANNED_SPRITES[p.sprite];
    const size = spriteSize(p.sprite) ?? (planned === undefined ? { w: 0, h: 0 } : { w: planned[0], h: planned[1] });
    x0 = Math.min(x0, p.x);
    y0 = Math.min(y0, p.y);
    x1 = Math.max(x1, p.x + size.w);
    y1 = Math.max(y1, p.y + size.h);
  }
  return { x: x0, y: y0, w: x1 - x0, h: y1 - y0 };
}

/** xorshift32 seeded by `fnv1a(seed)`; returns floats in [0, 1). */
function rng(seed: string): () => number {
  let s = fnv1a(seed) || 1;
  return () => {
    s ^= s << 13;
    s ^= s >>> 17;
    s ^= s << 5;
    return (s >>> 0) / 0x1_0000_0000;
  };
}

/** CONFETTI_COUNT particles over `area`, deterministic for `seed`, starting at `startMs`. */
export function confetti(seed: string, area: Rect, startMs: number): Particle[] {
  const r = rng(seed);
  return Array.from({ length: CONFETTI_COUNT }, (_, i) => ({
    x: area.x + r() * area.w,
    y: area.y + r() * area.h,
    vx: (r() - 0.5) * 40,
    vy: -20 - r() * 30,
    spin: 2 + r() * 6,
    colour: ART_COLOURS.confetti[i % ART_COLOURS.confetti.length] ?? 'lamp1',
    startMs,
  }));
}

/** Particle positions at `ms` under gravity, with a sideways wobble; empty before the start or after CONFETTI_MS. */
export function confettiAt(particles: readonly Particle[], ms: number): ParticleAt[] {
  return particles.flatMap((p) => {
    const dt = ms - p.startMs;
    if (dt < 0 || dt >= CONFETTI_MS) return [];
    const t = dt / 1000;
    return [
      {
        x: Math.round(p.x + p.vx * t + Math.sin(p.spin * t) * 2),
        y: Math.round(p.y + p.vy * t + 0.5 * CONFETTI_GRAVITY * t * t),
        colour: p.colour,
      },
    ];
  });
}
