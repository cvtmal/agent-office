# #02 office-scene — outcome (2026-11-11)

## Delivered
The canvas now draws the office. Each project gets its own room: a CTO corner office, desk groups A–D, an open area, a kitchen, a whiteboard and a done wall, drawn on the 480x270 scene at whole-number scale (1x/2x/4x). The CTO sits in the corner office, each lane session at its group's lead desk, and interns sit next to their parent. Characters are layered sprites (8 builds x 6 cloth sets, skin, hair, face, accessory and overlay), and the look is a pure function of the id, so it never changes between loads. Every character has a name tag. A light layer dims the room and turns on desk lamps and monitor glow for live sitters. Characters play a 4-frame idle loop (breathe, blink), and the loop holds still under reduced motion. Two themes exist (harbor = nerd, notes-app = neon). Project tabs appear when there are 2 or more projects. The stretch goal (OFFICE-7 static content) also landed: the wave and the CTO generation on the whiteboard, and one numbered frame per outcome on the done wall. A dev gallery at `?view=looks` shows 44 looks. Everything except `mount.ts`, `gallery.ts`, the atlas canvas half and `ui/tabs.ts` is DOM-free and unit-tested (529 tests).

## Interfaces
- **Seats** `office/seats.ts`: `assignSeats(characters, spots, previous?) → { seats: Map<id, spotName>, overflow: id[] }`. Live characters go before ended ones, newest first. `previous` keeps seats that are still valid. Ended characters stay at their seat with the lamp off.
- **Spots** `office/layout.ts`: `SPOTS`, `spot(name)` (throws if the name is unknown), `Spot { name, kind, x, y, group?, slot?, desk?, lamp? }`. `(x, y)` is the feet anchor. Use `characterFrame(spot, intern)` and `isSeated(kind)`. Names: `cto`, `<L>-lead`/`<L>-second`/`<L>-intern-1..2`, `open-1..6`, `open-intern-1..4`, `stand-1..2`, `kitchen-1..4`, `couch-1..2`, `door` (kitchen, couch and door are unused until #5). The file also holds `ZONES`, `PROPS`, `LAMP_POINTS`, `THEME_LIGHTS`, `WHITEBOARD_TEXT`, `SEAT_DROP` (13) and `SEAT_DROP_INTERN` (9).
- **Looks** `office/look.ts`: `lookFor(id, intern) → Look` (one FNV-1a hash per field, fields in `sprites/characters/space.ts` `LOOK_FIELDS`), `lookKey(look)` (prefix `a:`/`i:`). Rasters: `composeCharacter(look, frame 0-3)` gives 32x48 (`sprites/characters/compose.ts`), `composeIntern(look, frame)` gives 24x36 (`sprites/interns/index.ts`), `portraitFor(look, intern)` gives a 48x48 portrait for #6 (`sprites/characters/portrait.ts`). `idleFrame(timeMs, id, reduced)` is in `office/idle.ts`.
- **Scene** `office/scene.ts`: `buildScene(snapshot, projectId, previousSeats?) → { project, theme, seats, overflow, items, lamps }`. `items` is the y-sorted dynamic layer (`DrawItem`: characters and `sort` props). `backgroundProps(theme)` lists the cached background props. `wallContent(project) → { wave, gen, frames[12] } | null` (null outside harness rooms), and `wallKey` is its cache key.
- **Lamps**: `lamp:cto`, `lamp:<spot>` (desk lamp), `glow:<spot>` (monitor), `lamp:coffee`, `moon:window`, `neon:sign`, `neon:fairy`. A lamp is on when its id is in `scene.lamps`. `buildScene` adds `lamp:`+`glow:` for every non-ended sitter, and adds `ALWAYS_LIT` and `theme.lights` every time. To switch a lamp, add or remove its id there. `mount.ts` then rebuilds the light layer (`render/light.ts` `lightRaster`), because `lightKey` changes. A monitor whose glow is off shows its `off` sprite (`monitor-off`).
- **Mount** `office/mount.ts`: `mountOffice(canvas, store, { reducedMotion?, view? })`. It writes these attributes on `#office`: `data-room` (project name, or `looks`), `data-drawn` (characters drawn), `data-overflow` (characters not seated), `data-frame-ms` (p95 frame CPU time, refreshed once a second), and `data-scale` (from #0).
- **Atlas** `render/atlas.ts`: `createAtlas(size = 1024)` returns `{ add(id, raster), has, draw(ctx, id, x, y), size }`. It is a shelf-packed canvas sheet that doubles its size when full. Mount ids: `look:<lookKey>:<frame>`, `tag:<text>` and the sprite ids.
- **Tags** `office/tags.ts`: `tagText(c)` picks name, else agentType, else the first 8 id characters, capped at 10 glyphs with `…`. `layoutTags(subjects)` / `placeTags` resolve overlaps by stepping up 7 px (at most 3 steps). `tagRaster(text)` draws the tag.
- **Render core** `render/`: `palette.ts` (named ramps, `colour`, `ramp`, `rampMap`), `raster.ts`, `hash.ts` (`fnv1a`), `font.ts` (pixel font), `stats.ts` (`FrameStats`), `loop.ts` (`startLoop`: 60 Hz fixed-step update, drawing on rAF). Sprites are listed in `sprites/registry.ts` (`FAMILIES`, `spriteById`, `rasterizeSprite`). Themes: `office/theme.ts` (`themeFor(projectId)`, `NERD`, `NEON`, `themedSprite`).
- **Store** `app/store.ts`: `UiState.activeProjectId: string | null` (null means the first project). `ui/tabs.ts` `mountTabs(el, store)` renders `nav.tabs[role=tablist] > button.tab[role=tab][aria-selected][data-project-id]` and calls `setUi({ activeProjectId })`.
- **`ui/status.ts`**: now writes only into its own child `<span class="status">`, so the tabs in `#overview` survive a status update.
- **Make**: new target `make sprites` (`SPRITE_PNG=1 vitest run test/sprite-preview.test.ts`). It writes a 4x PNG sheet per sprite family to `var/sprites/<family>.png`, so sprites can be judged without a browser. The PNG encoder is in `test/sprite-png.ts` (Node `zlib`).
- **Dev view**: `/?view=looks` shows 30 hashed looks (`look-00`…`look-29`) plus the 14 sample looks, with tags and the light layer off.
- `src/shared/types.ts`: unchanged. `package.json`: unchanged (no new dependency).

## How to use it
- #5 (life): move a character by giving `assignSeats` a different `previous` or by animating its `DrawItem` x/y. The spots (incl. `door`, `kitchen-*`, `couch-*`) are in `layout.ts`. Lamps switch through `scene.lamps`. The done wall is filled by `wallContent`.
- #6 (inspector): `portraitFor(lookFor(id, kind === 'agent'), intern)` gives the portrait. The tab state is `ui.activeProjectId`, and `data-*` on `#office` serves for e2e checks.

## Decisions
- P-1 PNG preview + `make sprites` (Node zlib, test-side only). Undo: drop the target and `test/sprite-png.ts`/`sprite-preview.test.ts`.
- P-2 Geometry: 16-px tiles, zones as planned. The desk rows put feet at y 124/188, the open area at y 250. Undo: edit `ZONES`/`SPOTS` in `layout.ts`.
- P-3 Spot = feet anchor; seated frames drop 13 px (interns 9). Undo: `SEAT_DROP*`.
- P-4 Characters face the viewer behind their desk. The desk front is drawn after the character. Undo: the `sortY` values in `PROPS`.
- P-5 Look space and FNV-1a per field. It is pinned by tests: 14 distinct looks in the sample. Undo: `space.ts` counts (this changes every look).
- P-6 6 cloth sets plus 5 hair ramps in `compose.ts` (`CLOTH_SETS`, `HAIR_TONES`). Undo: edit the tables.
- P-7 Two themes, picked by the hash of the project id (harbor = nerd, notes-app = neon). Undo: `THEMES` / `themeFor`.
- P-8 Light = pure rasters, a `multiply` night layer plus `screen` lamp cores, rebuilt only when `lightKey` changes. Undo: drop the light pass in `mount.ts`.
- P-9 Cached background per room+theme+wall; a y-sorted dynamic layer; light; tags; p95 written to `data-frame-ms`. Undo: `mount.ts`.
- P-10 Idle: 4 frames x 450 ms with an offset per id. Reduced motion holds frame 0. Undo: `idle.ts`.
- P-11 Portraits are a 2x crop of the head (interns 3x). Detailed parts are left to #7. Undo: `portrait.ts`.
- P-12 Gallery at `?view=looks` (a dev aid, it also serves as the 44-character frame-time test). Undo: `gallery.ts` and the view switch in `mount.ts`.
- P-13 Tags: name, then agentType, then the id; 10 glyphs at most; collisions step up 7 px. Undo: `tags.ts`.
- P-14 Screenshots are kept in `.rpi-tracking/screens/office-scene/` (G2 set below).

## Deviations
- Ramp order in `palette.ts` is by luminance. Added `ramp`/`rampMap`/`rgba(alpha)` and the raster helpers `blank`/`blit`. Family exports are named `<family>Family`.
- The notes-app theme vector hashes `/home/demo/code/notes-app`, the full project id. The bare name hashes to the other theme.
- Layout: `Prop` gained `spot`, `off` and `lamp`. Theme lights live in `THEME_LIGHTS`. The kitchen checker is toned down by a theme recolour. Lamps moved 3 px down, `chair-cto` 10 px up, `poster-map` 2 px up.
- Sprites: builds 20–26 px wide (the plan said 22–26). Eyebrows were added in the hair layer. Parts are 20x20 boxes. Extra sprites `monitor-l`/`monitor-off-l`. Interns wear a lanyard and have no beards. `fitTop` in compose fixes head clipping on head-y-3 builds.
- Tags sit above the measured ink top of frame 0, and their x is clamped to the scene.
- Done wall: the label is a 2-digit `nn` drawn on the certificate (the plan said 4 glyphs under the frame; neither fits). With more than 12 outcomes, the last 12 are shown.
- Shots are written straight under their G2 names. Crispness was checked with a script outside the repo (no PNG decoder dependency).

## Carried forward
- Art polish (#5, or a later art cycle):
  - The neon room is less saturated than the reference.
  - The ceiling is a dark band, not an attic slope.
  - The floor between the desk rows is bare.
- Desk chairs are hidden behind seated characters; this needs a wider or taller chair sprite (#5/art).
- Monitors and lamps cover sitters' chins and shoulders, and an unlit `monitor-off` darkens the face (#5 layout/props).
- The clothes highlight slot `x` renders as the base tone. It needs the palette ramps `green2`/`blue2`/`magenta2`/`orange2`, then a 4th tone per material in `MATERIALS` (art cycle).
- Interns with deep skin + dark hair (+ headphones) are muddy at 1x. Glasses in the cocoa accent are dark on deep skin (art cycle).
- Done-frame labels cover the medal; the slug inside the frame is still missing (#5/#6).
- Ended characters' tags are as bright as active ones (#5/#6). Tags in the gallery's top rows sit edge to edge (dev aid only). `placeTags` can leave overlaps after 3 steps in a full room (#5).
- No arrow-key navigation inside the tablist (#6).
- Review note: a sticky `previous` seat lets an intern keep any intern/stand spot, so after its parent is re-seated it can stay at the old desk (#5, when it starts passing `previous`).
- `layout.ts` imports `sprites/registry.ts` (for `spriteSize`): a cycle risk if a sprite file ever imports layout (whoever touches layout next).
- When the 800x600 resize runs under `make dev`, the Vite client logs `ResizeObserver loop completed…` to the dev server. It is not a page console error. The cause is #0's `render/canvas.ts`, which sets the size inside its ResizeObserver callback. Defer it to rAF (#3, or whoever touches canvas.ts next).
- Landing: `main` has since changed the `Makefile` `.PHONY` line and the `fixtures` target (#1: `compare-ctx`, transcripts). The rebase in `bin/harness/land` must keep both those changes and `sprites` (CTO).

## Verification
- `make lint` 0 · `make test` 0 (45 files, 529 passed, 1 skipped = the opt-in sprite preview) · `make build` 0 · `make e2e` 0 (6 passed, no console errors/warnings).
- `make dev` serves on 8002: `/` 200, `/?view=looks` 200, `/api/snapshot` 200. `make stop` frees the port.
- e2e pages, both rooms plus the gallery: 1x at an 800x600 viewport in `desktop` (`data-scale="1"`), 2x at 1280x800 in `desktop`, 4x at 1280x800 DPR 2 in `desktop-2x`. Harbor `data-drawn="9"`, notes-app `5`, overflow `0`.
- Frame time p95: 0.2 ms, in harbor and in the 44-character gallery (headless Chromium, Apple silicon). The budget is 16 ms.
- G2 set, in `.rpi-tracking/screens/office-scene/`: `office-harbor-{1x,2x,4x}.png`, `office-notes-app-{1x,2x,4x}.png` and `looks-2x.png`. Each was judged against the art checklist in the changes log. 1 scene pixel = n×n device pixels at 2x/4x.
- Pending for a human: frame time on the owner's Mac in a real browser (OFFICE-1; the Playwright number is a proxy), and the owner's art judgement on the G2 set.
