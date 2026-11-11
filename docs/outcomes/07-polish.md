# #07 polish — outcome (2026-11-12)

## Delivered
v1 is finished apart from the memory limit. The server's memory leak is fixed: the last read of each transcript was kept alive, and whole files were parsed before being slimmed (RSS 362 MB → 119–181 MB). Start-up is 1.3–1.4 s. Detail mode works (`--detail` or config `detailMode`, off by default, one start-up warning). The sound switch plays small Web Audio sounds (typing tick, coffee, landing fanfare), off by default and started only after a user gesture. There is an art-id contract (`art-ids.ts`) and `docs/design/art-seam.md`. A third synthetic project `studio` (12 characters) is used to measure frame time: 0.3 ms p95 at 1280×800 and at 2×. #5's weak art is fixed (meter track, bubbles over tags, standing intern bowing its head, typing hands). The visual pass over the harness replay fixed overlays drawn under props, the CTO cheering while walking, and bubbles at the top edge. `README.md` is rewritten.

## Interfaces
- `src/shared/types.ts`: **added** `Activity.detail?: string` (raw tool input as JSON, ≤ 2000 chars, only when detail mode is on). Nothing renamed or removed.
- CLI `--detail`; config key `detailMode: boolean` (default false; bad values warn and fall back to the default). The old D-019/G3 rejection is gone. One stderr warning at start when it is on.
- `reader/retain.ts` `retain(prev, chunk, kind, { keepInput? })`; `reader/target.ts` `DETAIL_MAX = 2000`, `detailText`; `live/tail.ts` `read(each?)` hands each parsed piece of ≤ 1 MiB to `each(chunk, reset)`.
- `src/client/app/sound.ts` `mountSound(store, audio?, gestures?)`, `PEAK_GAIN`; `app/sound-events.ts` (pure) `soundsFor(prev, next)`, `createGate(minGapMs)`. `main.ts`: one appended `mountSound(store)`.
- `src/client/office/art-ids.ts`: `WALK_FRAME_NAMES`, `HEAD_FRAME`, `CHEER_FRAME_NAMES`, `LIFE_IDS` (was `LIFE_SPRITES` in `life/constants.ts`), `ART_COLOURS` (`CONFETTI_COLOURS`, `WALL_INK`, `WALL_PAPER` removed); `art-ids.test.ts` is the contract test.
- `office/life/draw.ts` `placeBubbles(bubbles, tags)`. `sprites/characters/compose.ts` `HeadDown` accepts `{ bow: n }`; `sprites/interns` `INTERN_HEAD_DOWN = { bow: 2 }`.
- `ui/inspector.ts` `detailBlock(doc, detail)`: a closed `<details>` "input" with a `<pre>` that wraps and scrolls.
- Makefile `bench-mem: build` (reason: RUN-3 must be measured on the built server; not a gate). `test/bench-set.ts`, `test/bench-server.ts`, `test/live-mem.bench.ts`.
- `fixtures/snapshots/sample.json`: additions only (D-038). Projects 2 → 3, characters 14 → 26, activities 28 → 40. The tests that assert the total were updated mechanically (PL2).

## How to use it
- A new art set must provide every name in `src/client/office/art-ids.ts`; run `make test` (`art-ids.test`), then read `docs/design/art-seam.md`.
- New sounds: add a kind in `app/sound-events.ts` `soundsFor` and a voice in `app/sound.ts`.
- Re-measure: `make bench-mem` (start-up, RSS); `make e2e` "frame time with 12 characters" (`e2e/life.spec.ts`).

## Decisions
- PL2: `studio` is a non-harness project, so lane, filter and per-room tests stay as they were. Undo: a separate fixture file.
- PL3: logic talks to art only through `art-ids.ts`. Offsets and `layout.ts → spriteById` are documented as known couplings, not moved.
- Memory: the lever is retaining piece by piece, not a reader redesign (D-037). The bench keeps its 150 MB assertion and fails honestly.
- Sound waits for the first `pointerdown`/`keydown` before it creates its AudioContext. This fixed the Chrome autoplay warning that failed `controls.spec`.
- Overlays are drawn in a pass after all scene items. A cheer starts when the character arrives. A bubble that cannot be lifted slides sideways.
- README footprint lists the measured range, not the best run. That is more honest given the run-to-run spread.

## Deviations
- **RSS limit (RUN-3) not met reliably.** One run on 2026-11-11 gave 119 MB. On 2026-11-12 at HEAD: 151, 156, 171, 181 MB. Phase 1's own commit `67ff802`, re-run the same day: 138 and 179 MB. No server code path changed after it with detail mode off, so the spread comes from the run or the machine, not from later #7 work. The likely cause, not proven, is V8 keeping the heap that grows during start-up. README and this file record the range.
- Step 5.1: the plan's seating fallback misread `seats.ts`. Seating goes by kind, so `studio` has 6 sessions and 6 agents.
- `test/bench-server.ts` was added (not in the plan): helpers cannot be exported from a `*.bench.ts` file.
- `ui/controls.ts`: stale comment "no audio until #7" updated (comment only).

## Carried forward
- **Memory** (RUN-3, CTO decision D-039: #7 lands with the measured range, a `fix-memory` lane follows): RSS 119–181 MB (151–181 MB at HEAD on a busy machine). Next levers to try: measure the peak during start-up versus after it settles; read files one at a time at start-up; V8 flags (`--max-semi-space-size`, an idle GC). A reader redesign was out of scope (D-037).
- **Flaky e2e** "reduced motion never walks" (`e2e/life.spec.ts`, `maxMovingRun` 2 > 1, about 1 in 6–12 runs). Also happens on `main`, so it was not caused by #7 → #5's probe owner or #7b. It passed in this session's run (29/29).
- **Open art items (c07-impl-4)**, for an art follow-up or #7b:
  - c02-impl's tag and its "make" bubble cover the done-wall plaque label.
  - The intern's bow is subtle at 2×, and the head sinks a little into the shoulders.
  - At the CTO desk the typing hands sit at chest height, off the keyboard (overlay placement).
  - At desk-group seats (`studio`) no hands show at all; not investigated.
  - The couch character arrives on time after 2 min but stands in front of the couch: there is no sit pose.
  - The waiting raised hand has low contrast for a dark skin tone against brick.
- #6 minor UI items, not scheduled: Fit on wide windows; the hotspot rebuild loses clicks; thin focus ring; disposers for the strip and controls. Hotspots for unseated overflow characters, and `startedAt` and context-window size in the API, still wait on a contract change by the CTO.
- If the saved sound pref is on at page load, nothing plays until the first click or key press (by design; a person should check that it feels right).
- `docs/outcomes/05-office-life.md:7` still names the old `LIFE_SPRITES` (a record of #5, left as it is).
- Review (c07-review), minor, not scheduled: the `--detail` warning also prints with `--sample`, which carries no detail; `tail.test.ts` turns on `--expose-gc` for its whole Vitest worker.

## Verification
- 2026-11-12, HEAD + README edit: `make lint` 0; `make test` 0 (106 files, 1274 passed, 1 skipped); `make build` 0; `PORT=8001 make e2e` 0 (29 passed). Frame time p95: studio 12 characters 0.3 ms (desktop and 2×), harbor 0.2–0.3 ms.
- `make bench-mem` exit 2 (RSS) in 4 of 4 runs: start-up 1.30–1.36 s, RSS 151–181 MB, 20 characters.
- Privacy sweep (`git grep '/Users/|claudep|\.claude/projects'` over src, test, e2e, fixtures, README, docs/design): only the guard tests and a synthetic `/home/dev/...` path from #1. Nothing under `var/` or `.rpi-tracking/` is staged.
- Fresh clone (Phase 8): `make install`, `make start`, `bin/agent-office --sample`, `npx agent-office --help` all work with only Node installed.
- Visual pass screenshots (not committed, in the lane's `.rpi-tracking/check/`): `07-meter-{before,after}`, `07-bubbles`, `07-bubbles-walkin{,-after}`, `07-intern-stopped{,-710}`, `07-hands-{before,after}`, `07-overlays{,-studio,-after,-replay-after}`, `07-sample-desks{,-after}`, `07-folder`, `07-couch`, `07-waiting-hand`, `07-warn-handover`, `07-cheer-{before,after}`, `07-pause`, `07-detail-card` (all `.png`). Checked at 1280×800 and 2×.
- Pending human: how the sounds sound; the detail card on a real replay with `--detail`; a real phone and VoiceOver (from #6); art-direction Checklist 1–4 judged by a person.
- Review re-ran `make lint` 0, `make test` 0 (106 files, 1274 passed, 1 skipped), `make build` 0, `make fixtures` (no diff). Built server on port 8001 with the harness replay: with `--detail`, one warning and 27/27 activities carry `detail`; without it, no warning and no `detail` key. Privacy sweep of the diff: no real paths, ids or secrets; fixture session ids match no local transcript.
