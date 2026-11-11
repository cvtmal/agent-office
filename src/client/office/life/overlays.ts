// Pose overlays (research R3, R12): small `life-*` sprites drawn on the desk, the monitor
// or above it (not on the arms, which the monitors cover), one set per activity kind,
// plus the raised hand and the coffee mug. Positions are sprite top-lefts. DOM-free.
import { PROPS, characterFrame, spot as spotOf, type Prop, type Spot } from '../layout.js';
import { arrived, type Actor } from './actors.js';
import { LIFE_IDS } from '../art-ids.js';
import { FOLDER_MS, HANDS_FRAME_MS, STEAM_FRAME_MS } from './constants.js';
import type { Point } from './grid.js';

/** One overlay sprite to draw at its top-left. */
export interface OverlayDraw {
  sprite: string;
  x: number;
  y: number;
}

/** Where the per-kind overlays of a desk go. */
export interface DeskAnchor {
  /** Top-left of the monitor sprite (terminal glow, globe). */
  monitor: Point;
  /** Over the keyboard (typing hands). */
  keys: Point;
  /** On the desk top, on the side away from the monitor (papers; the folder starts here). */
  desk: Point;
  /** Above the monitor (sticky note). */
  wall: Point;
}

const propBySlot = new Map<string, Prop>(PROPS.map((p) => [p.slot, p]));

/** Overlay anchors of a seat with a desk (desk, open and cto spots); undefined for others. */
export function deskAnchor(s: Spot): DeskAnchor | undefined {
  const monitor = propBySlot.get(`monitor:${s.name}`);
  const desk = propBySlot.get(`desk:${s.name}`);
  if (monitor === undefined || desk === undefined) return undefined;
  const keyboard = propBySlot.get(`keyboard:${s.name}`) ?? propBySlot.get(`desk-top:${s.name}`);
  const monitorLeft = monitor.x < s.x;
  return {
    monitor: { x: monitor.x, y: monitor.y },
    keys: keyboard === undefined ? { x: s.x - 6, y: desk.y - 2 } : { x: keyboard.x, y: keyboard.y - 2 },
    desk: { x: monitorLeft ? s.x + 4 : s.x - 14, y: desk.y + 1 },
    wall: { x: monitor.x + 2, y: monitor.y - 10 },
  };
}

const frame2 = <T>(pair: readonly [T, T], timeMs: number, frameMs: number, reduced: boolean): T =>
  reduced || Math.floor(timeMs / frameMs) % 2 === 0 ? pair[0] : pair[1];

const at = (sprite: string, p: Point, dx = 0, dy = 0): OverlayDraw => ({
  sprite,
  x: Math.round(p.x + dx),
  y: Math.round(p.y + dy),
});

/**
 * Overlays of an actor standing at its target (R3): busy by kind (read papers, write and
 * other typing hands, shell terminal glow, web globe, delegate folder travelling to the
 * intern spot, plan sticky note); waiting raised hand; coffee mug + steam. Reduced motion:
 * frame 0 of every 2-frame overlay, the folder parked at the intern spot.
 */
export function overlaysFor(
  actor: Actor,
  timeMs: number,
  reduced: boolean,
  internSpotOf: (id: string) => Spot | undefined,
): OverlayDraw[] {
  if (actor.gone || !arrived(actor)) return [];
  const { pose, kind } = actor.target;
  const seat = spotOf(actor.target.spot);
  const rect = characterFrame(seat, actor.intern);

  if (pose === 'raiseHand') return [at(LIFE_IDS.hand, rect, rect.w - 10, 2)];
  if (pose === 'coffee') {
    const mug = { x: rect.x + rect.w - 10, y: rect.y + rect.h / 2 };
    return [
      at(LIFE_IDS.mug, mug),
      at(frame2(LIFE_IDS.steam, timeMs, STEAM_FRAME_MS, reduced), mug, 0, -7),
    ];
  }
  if (pose !== 'sit' || kind === null) return [];

  const anchor = deskAnchor(seat);
  if (anchor === undefined) return [];
  switch (kind) {
    case 'read':
      return [at(LIFE_IDS.papers, anchor.desk)];
    case 'shell':
      return [at(LIFE_IDS.terminal, anchor.monitor, 1, 1)];
    case 'web':
      return [at(LIFE_IDS.globe, anchor.monitor, 2, 1)];
    case 'plan':
      return [at(LIFE_IDS.sticky, anchor.wall)];
    case 'delegate': {
      const intern = internSpotOf(actor.id);
      if (intern === undefined) return [at(LIFE_IDS.folder, anchor.desk)];
      const end = { x: intern.x - 4, y: intern.y - 16 };
      const t = reduced ? 1 : (timeMs % FOLDER_MS) / FOLDER_MS;
      return [
        at(LIFE_IDS.folder, {
          x: anchor.desk.x + (end.x - anchor.desk.x) * t,
          y: anchor.desk.y + (end.y - anchor.desk.y) * t,
        }),
      ];
    }
    case 'write':
    case 'other':
      return [at(frame2(LIFE_IDS.hands, timeMs, HANDS_FRAME_MS, reduced), anchor.keys)];
  }
}
