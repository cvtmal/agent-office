# #05 office-life — outcome (2026-11-11)

## Delivered
The office is alive. A pure, DOM-free life model (`src/client/office/life/`) decides where each character is and what it shows. `buildScene`/`assignSeats` still decide where a character belongs. Characters walk along a walk grid (BFS, never teleport). Busy characters sit with an overlay per kind (papers, skin-toned typing hands, green terminal, globe, folder to intern, sticky note). Idle characters fetch coffee in the kitchen and move to the couch after 2 min. Waiting raises a hand, stopped puts its head on the desk, ended walks out of the door. After 5 min the desk is tidied: the character is dropped from the seat plan. Lamps light only for busy and waiting. Every character has a meter above it in its verdict colour and sweats at RECYCLE and HANDOVER. A bubble shows one icon and target for 3 s, one per character, and a burst is merged into ` xN`. The done wall gets a caption plate `<nn> <slug>`, and a new outcome brings confetti plus a cheering character. Reduced motion jumps characters to their targets without walk frames or confetti. Pause freezes everything. Tags, meters, bubbles and #6's hotspots follow walkers. Intern seats are sticky to the parent's desk group. The harness replay set gained appended cases (WARN/RECYCLE, a burst, `other`, a stopped agent, a waiting window).

## Interfaces
- `office/life/`: `constants.ts` (timings, `LIFE_SPRITES`), `grid.ts` (`buildGrid`, `cellOf`, `walkable`), `path.ts` (`findPath`, `unreachableCount`), `clock.ts` (`createServerClock`), `actors.ts` (`planTargets`, `syncActors`, `stepActors`, `actorFrame(a, timeMs, reduced)`, `Pose`), `overlays.ts` (`overlaysFor`, `deskAnchor`), `bubbles.ts` (`createBubbles`, `bubbleText`, `newActivities`), `meter.ts` (`meterFill`, `meterSize`, `showMeter`, `sweats`), `celebrate.ts` (`newOutcomes`, `cheererFor`, `confetti`), `draw.ts` (bubble box and placement, meter rect, sweat position). `README.md` describes how they fit together.
- `office/scene.ts`: `buildScene(…, { hideEnded, nowMs })` (no `nowMs` means no tidy), exported `tidied()`, `WallContent.plate`. Lamps and glow only for busy/waiting.
- Sprites: pose frames `walk0-3`, `head`, `cheer0/1` (`characters/compose.ts` `POSE_FRAMES`, `posed()`, `characters/poses.ts`), sprite id `look:<key>:<pose>`. New family `sprites/life/` (`life-papers`, `life-hands0/1`, `life-terminal`, `life-globe`, `life-folder`, `life-sticky`, `life-hand`, `life-mug`, `life-steam0/1`, `life-sweat0/1`). Hands are packed per skin as `<id>@skinX`.
- DOM: `#office[data-moving]` (actors moving) and `[data-bubbles]` (visible bubble count).
- Fixtures: `fixtures/replay/harness` appended. Builder 696–708 s: WARN ~699, Explore agent stopped by the user 700–704, error 704, RECYCLE ~707, open `make test`. Researcher 707–713 s: 20-call burst, `mcp__demo__ping` (`other`), thinking. Live window `waiting` for the researcher 600–660 s.
- No `types.ts` change, no new dependency, `main.ts` untouched.

## How to use it
- #7 sound: hook bubbles and celebrations where `mount.ts` (`// #5 office-life` block, `rebuild`) pushes new activities and new outcomes.
- New poses or overlays: add a frame to `POSE_FRAMES` (compose.ts) and a case in `actorFrame`/`overlaysFor`. `registerLooks` packs every look's poses.
- Timings (couch 2 min, tidy 5 min, bubble 3 s, walk speed) are in `office/life/constants.ts`.

## Decisions
- R1–R13 (research) and PL1–PL6 (plan) as written. Most visible: PL4 tidy = dropped from `assignSeats` after 5 min (undo: remove the `nowMs` filter); PL5 confetti with `fillRect`; PL6 tags drawn at a fixed offset while walking.
- Grid rule: a spot's own props never block the rows below its foot row (otherwise the CTO's seat was boxed in).
- An ended character with `lastActivityAt` null is tidied at once. On a room switch, characters are placed at their targets without walking in. Bubbles and confetti are drawn only for the active room.
- Plate: under the whole done wall (y 68–75), from the newest frame's x, cut at the wall's right edge.
- Meter: 16×3 (agent) or 12×2 (intern), 1 px under the tag, never over the head. Any fill above zero shows at least 1 px.
- Bubble counter ` xN` instead of ` ×N`: the pixel font has no `×` (it showed `?20`). Undo: add a `×` glyph to `render/font.ts` (#2).
- Bubble boxes are kept in at most 64 cached small canvases, not in the atlas.

## Deviations
- The appended replay cases sit at 696–713 s, not the plan's ~300–600 s. The existing transcripts end at ~700 s and the set is append-only.
- Edits on lines tagged `// #6` in `mount.ts`: `characterBoxes(frameItems)` (planned); `buildScene` options in a local `opts` that adds `nowMs`; the character draw line picks the pose sprite before `idleFrame`. The paused guard is kept verbatim, and a second guarded line steps life.
- Tidy changes the drawn counts in other cycles' e2e specs: the sample's three ended characters ended hours earlier, so harbor shows 9→8 and notes-app 5→3. Specs updated: `scene`, `controls` (with hide-ended 8→8), `keyboard`, `replay`.
- The frame-time check "≥ 14 characters" cannot run on `--sample`, which draws at most 11. It was measured on the sample rooms and on the walking replay instead.
- Rebase onto #6: the sprite family list keeps both new families, in the order `…, interns, icons, life`.

## Carried forward
- An intern's head-down pose is drawn standing (interns have no chair), so it reads as a figure with its head bowed onto its arms in mid-air. The agent head-down pose looks a little like a tray on wide bodies. Art polish → #7.
- Neighbouring bubbles and tags can overlap. There is no collision handling for bubbles, or for tags while walking (out of scope) → #7.
- The meter's empty track (`night0`) hardly shows against dark tags and floor, so a low fill reads as a dot → #7 (lighter track colour).
- Review (c05-review): at replay speed 1 the CTO walks back from the kitchen (545–555 s) and sits in its chair (seated frame, lamp, overlay). At speed 5 its busy windows are shorter than the ~10 s walk, so it turns round first. Not checked: whether the CTO cheers while still walking (walk frames take priority over cheer frames) → #7.
- Minor review findings, not scheduled (D-027): frame time measured with 11 characters, not 14; checklist items 2–6, 10, 11, WARN/HANDOVER on screen, cheer and pause still pending on screen; a walk of ~10 s from kitchen to desk means short busy spells never reach the desk (walk speed → #7).

## Verification
- `make lint` pass · `make test` 103 files, 1198 passed, 1 skipped · `make build` pass · `make e2e` 27 passed, 3 skipped (existing desktop-only guards). `e2e/life.spec.ts` frame time is 0.2 ms in both sample rooms and 0.3–0.4 ms in the walking replay at 1280×800 and 2×. In the replay, `office:layout` events carried boxes that moved; with reduced motion, `data-moving` was never true for more than one frame.
- Harness replay at speed 5 on port 8002: Playwright capture every ~0.8 s at 1280×800 (`.rpi-tracking/check/capture.mjs`, state log `check/r1/state.jsonl`). Checklist, with replay seconds:
  - [x] 1 walk in from the door (30–50 s, `05-walk-in.png`) · [x] busy at desk with overlay + bubble (95 s, `05-busy.png`, `05-busy-zoom.png`; plan = sticky)
  - [~] 2–6 each kind's overlay (papers, typing, terminal, globe, folder) is covered by unit tests (`overlays.test.ts`); not each seen on screen → pending human
  - [x] 8 `other` + 18 burst = one bubble `mcp__demo__… x20` (707–713 s, `05-recycle-burst-stopped.png`; that shot still shows `?20`, from before the fix)
  - [x] 9 idle → kitchen with a mug (CTO, 30 s on) · [ ] 10 couch after 2 min → pending human (the subagent saw it on `--sample`)
  - [ ] 11 waiting raised hand (600–660 s): the status is in the state log, the frame was not viewed → pending human
  - [x] 12 stopped head-down (intern 701 s, `05-stopped-intern.png`; reads weak, see Carried forward)
  - [x] 13 ended walks out and 14 tidy: drawn 6→4 while moving at 487 s. The reviewer's interns had been inactive > 5 min, so they are tidied at once; the reviewer's own 5 min falls after the replay ends. Seen in data only.
  - [x] 15 lamps follow status (CTO desk lit while busy, `05-done-confetti.png`) · [x] 16 meter OK green, RECYCLE orange (705 s) · [ ] WARN on screen, HANDOVER (`--sample`) → pending human · [x] 17 sweat at RECYCLE
  - [x] 19 whiteboard `W1 CTO 1`, phase change at land in the state log · [x] 20 frame `01`, plate, confetti at 536–543 s (`05-done-confetti.png`) · [ ] CTO cheering not seen → pending human
  - [x] 21 reduced motion (e2e) · [ ] 22 pause freezes → pending human · [x] 23 tags, meters and bubbles follow walkers; hotspots follow (e2e)
- Art direction (10.2): palette only, outlines and shading as in the art direction. Weak spots are listed under Carried forward. The 2× pass ran in e2e (`var/screens/life-*-4x.png`), not in a separate manual pass.
