# #06 inspector-ui — outcome (2026-11-11)

## Delivered
The office can now be inspected and steered from real HTML. A layer of transparent `<button>` hotspots sits over the canvas, one per drawn character, so a click, or Tab and then Enter, opens the inspector card. The card shows a 48×48 portrait, name, kind, role, project, lane, status, tokens with a bar coloured by verdict, age, where, branch, agent type, and the last 10 activities with icons and local times. Esc or a click outside closes it, and Esc returns focus to the hotspot. The overview strip shows busy / idle / ended counts per project, the highest verdict, and the format drift sign (DATA-8). Five controls (zoom Fit/1×–4×, pause animations, a sound switch with no sounds yet, hide ended) and the project tab are saved in `localStorage` and restored on reload. The tabs follow the ARIA roving-tabindex pattern, and `prefers-reduced-motion` reaches the renderer live.

## Interfaces
- `app/store.ts`: `UiState` gains `zoom: number|null` (null = fit), `paused`, `sound`, `hideEnded`, `reducedMotion` (defaults null/false). `ZOOM_STEPS = [1,2,3,4]`.
- `app/prefs.ts`: `PREFS_KEY = 'agent-office:prefs'`, JSON `{ v: 1, zoom, paused, sound, hideEnded, activeProjectId }`; `parsePrefs`, `loadPrefs`, `savePrefs`, `serialisePrefs`, `safeLocalStorage`, `mountPrefs(store, storage?)`. `selectedId` and `reducedMotion` are never saved.
- `app/motion.ts`: `mountMotion(store, mql?)`, `REDUCED_MOTION_QUERY`, `safeMatchMedia`.
- `render/canvas.ts`: `scaleFor(zoom, availW, availH)`; `mountCanvas(canvas, container, store?)` re-scales on `ui.zoom`. The ResizeObserver resize is deferred to rAF.
- `render/verdict-colour.ts`: `VERDICT_COLOUR` (OK green1, WARN lamp1, RECYCLE orange1, HANDOVER magenta1), `verdictHex`. CSS `--verdict-ok|warn|recycle|handover`, checked by `test/palette-css.test.ts`.
- `office/boxes.ts`: `LAYOUT_EVENT = 'office:layout'` (CustomEvent on `#office`, `detail: CharacterBox[]` in 480×270 scene px, `[]` in the looks gallery), `CharacterBox {id,x,y,w,h}`, `characterBoxes(items)` (sorted y, x, id).
- `office/scene.ts`: `buildScene(snapshot, projectId, previousSeats?, opts: { hideEnded? })`.
- `office/mount.ts`: in the `#6 inspector-ui hooks` block (plus single lines marked `// #6`): `reducedNow()`, the paused clock, the `hideEnded` rebuild key, a local `layoutDirty` flag and `emitLayout()` at the end of `draw`.
- `sprites/icons/`: family `icons`, `icon-<kind>` for every `ACTIVITY_KINDS` entry, 8×8, `iconId(kind)`.
- `ui/inspector.ts`: `cardModel(snapshot, ui, now)`, `ageText`, `clock`, `verdictClass`, `mountInspector(el, store, { now, setTimer, clearTimer })`. `ui/strip.ts`: `stripModel`, `countsText`, `mountStrip`. `ui/hotspots.ts`: `hotspotModel`, `mountHotspots(room, canvas, store)`. `ui/controls.ts`: `mountControls`. `ui/tabs.ts`: `nextTab(ids, currentId, key)`.
- DOM: `#room` wraps `#office`. `button.hotspot[data-character-id]` has the label "<name>, <status>". The card is `article.card[data-character-id]` with `dd[data-field]`. Strip items are `li[data-project-id][data-drift]`. Controls are `button.control[data-control][aria-pressed]`: `zoom-fit`, `zoom-1…4`, `pause`, `sound`, `hide-ended`.

## How to use it
- #5, when characters move: set `layoutDirty = true` inside `mountOffice` (`office/mount.ts`). The hotspots follow on the next frame. Use `characterBoxes` for the boxes.
- #5 rebase, every #6 line in the shared files (line numbers at the landed commit; keep each line, merge around it):
  - `office/mount.ts`: `:22` import of `characterBoxes, LAYOUT_EVENT` · `:42` `OfficeOptions.reducedMotion` doc comment · `:82–98` the block `// #6 inspector-ui hooks` … `// end #6 inspector-ui hooks` (`reducedNow`, `lastHideEnded`, `layoutDirty`, `emitLayout`). It replaces #2's one-time `const reduced = …matchMedia(…)`. · `:244` `layoutDirty = true` at the end of `rebuildGallery` · `:253` `buildScene(…, { hideEnded: lastHideEnded })` in `rebuild` · `:267` `layoutDirty = true` at the end of `rebuild` · `:274` rebuild key `&& ui.hideEnded === lastHideEnded` in `onState` · `:279` `lastHideEnded = ui.hideEnded` · `:295` `idleFrame(timeMs, item.id, reducedNow())` in `draw` · `:312` `emitLayout()` as the last line of `draw` · `:319` `if (!store.getState().ui.paused) timeMs += dtMs` in `update`.
  - `office/scene.ts`: `:75` the 4th parameter `opts: { hideEnded?: boolean } = {}` of `buildScene` · `:87–89` the `#6` block in the character loop, after the seat lookup: `if (opts.hideEnded === true && c.status === 'ended') continue;`.
  - If #5 replaces `timeMs` or `idleFrame`, keep the paused check and `reducedNow()` on its new clock and frame choice. If #5 moves characters, set `layoutDirty = true` wherever a position changes.
- #5 meters: colour them with `VERDICT_COLOUR` / `verdictHex` (`render/verdict-colour.ts`) so they match the card and the strip.
- #7 sound: read `store.getState().ui.sound` (the switch exists, default off); reduced motion is `ui.reducedMotion`; pause is `ui.paused`.

## Decisions
- Research R1–R12 (accepted as D-025): HTML hotspots over the canvas (R1), positioned from the layout event (R2), card fields from the API as they are (R3), and the verdict colour map (R4). Strip idle counts idle + waiting + stopped (R5). Zoom is stored in the UI state (R6). Pause and reduced motion freeze the clock while the draw loop keeps running (R7). Prefs use a versioned JSON (R8). A selection that disappears is cleared (R9). Icons are sprites turned into data URLs (R10). No new dependency (R11). `mountCanvas` receives the store (R12).
- Plan P-2: "cwd relative to the repo" shows `Character.where`. Branch and agent type are shown as well, because the API has them; an empty `where` shows "—".
- Plan P-3 to P-7:
  - P-3: one verdict colour map.
  - P-4: hide ended skips drawing, not seating, so the room never reshuffles. Undo: filter before `assignSeats`.
  - P-5: the layout event fires from `draw` one frame after a rebuild, so later mounts never miss it.
  - P-6: hotspots are placed in percent of 480×270, so zoom needs no extra wiring.
  - P-7: roving tabindex on the tabs.
- `verdictClass` has a single home in `inspector.ts`. The controls build their buttons once, so focus survives a state change.

## Deviations
- `src/client/main.ts`: the existing `mountCanvas(...)` line now also passes `store` (R12). The six mounts are appended after `connectLive(store);`.
- `index.html`: `<div id="room">` wraps the canvas.
- `sprites/registry.test.ts`: the expected family list includes `icons`.
- `e2e/`: browser code gets `document` through the element given to `locator.evaluate`, because `tsconfig.node.json` has no DOM lib (a #0 hotspot, not changed). The pixel hash copies a region into a scratch canvas, to avoid Chrome's `willReadFrequently` warning.
- Additions beyond the plan:
  - `mountInspector` takes `clearTimer`.
  - Each activity `<time>` carries its relative age as a `title`.
  - `data-drift` is always set (`true|false`).

## Carried forward
- Hotspots for unseated overflow characters: none are drawn yet (`#office[data-overflow]` exists) → #5/#7.
- `startedAt` and the context-window size are not in the API, so the age shown is the time since the last activity and the bar measures against the role's last threshold → CTO, contract, if wanted.
- Screen-reader check with VoiceOver → a person (see Verification).
- `detailMode` stays off (G3). Sounds behind the switch → #7.
- Review notes, minor, not scheduled (→ #7 if wanted): on a wide, short window, choosing Fit after a fixed zoom can keep the large scale, because `#stage` grows with the canvas (`render/canvas.ts:33`, `ui/shell.css:30`); hotspots rebuild every button whenever a label changes, so a click can be lost (`ui/hotspots.ts:59`); the strip and controls disposers leave their elements behind (`ui/strip.ts:88`, `ui/controls.ts:64`).

## Verification
- `make lint` pass. `make test` pass (93 files, 1094 passed, 1 skipped). `make build` pass. `make e2e` (PORT=8001): 23 passed, 3 skipped by design.
- The new specs `inspector`, `controls` and `keyboard` passed 2× in a row in `desktop` and `desktop-2x`. They check:
  - the card against `/api/snapshot`;
  - the strip counts;
  - every control after a reload, a `localStorage` that throws, and reduced motion holding the idle frames;
  - Tab reaching tabs, controls and all hotspots; Enter and Esc.
- Privacy: `git grep -nE '/Users/|claudep' -- src test e2e fixtures` finds only the two guard tests. `git grep innerHTML -- src/client` finds nothing.
- Screenshots: `.rpi-tracking/screens/inspector-ui/inspector-desktop.png`, `inspector-desktop-2x.png` (Playwright, CTO card open). Visual check (Step 6.4), same folder: `visual-1280-{default,default-2x,card,card-2x,focus,zoom3}.png`, `visual-narrow-{420,900}.png`, `chrome-*.jpg`. Cream 1 px border on the dark panel, an unsmoothed 48×48 portrait at 2×, a verdict-coloured bar, icon rows. The card stacks below 1000 px with no horizontal page scroll. No console errors.
- Minor visual findings, not scheduled (→ #7 polish if wanted): the bar has no number and sits under Branch, not beside Tokens; "Where" shows "." for a repo-root cwd; the 1 px focus ring is thin and crosses the name tag below; at 420 px labels wrap and the 1× stage scrolls sideways inside itself; Fit leaves about 170 px of empty stage at 1280×800.
- Pending human verification: VoiceOver reading the hotspot labels and the card; a real phone.
- Review (c06-review) re-ran `make lint` (pass), `make test` (93 files, 1094 passed, 1 skipped) and `make e2e` (23 passed, 3 skipped by design). It also judged `visual-1280-card.png` against the art direction. Privacy sweep of the diff: only synthetic `/home/demo/…` fixture paths, no ids or config-dir content, nothing under `var/` or `.rpi-tracking/` tracked.
