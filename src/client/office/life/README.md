# office/life: the moving office (cycle #5)

Pure, DOM-free model of what characters do between snapshots. `buildScene`/`assignSeats`
decide where a character belongs; life decides where it is now and what it shows.
R-numbers refer to the decisions in the #5 research (`office-life-research.md`).

| File | What |
|---|---|
| `constants.ts` | Every life number (cell size, walk speed, couch/tidy delays, bubble and confetti timing) and the sprite/frame ids it draws (`life-*`, `walk0..3`, `head`, `cheer0/1`). |
| `grid.ts` | 8 px walk grid (60 x 34): back wall and `sort` prop footprints blocked, spot foot cells open (R1). |
| `path.ts` | BFS on the grid, N/E/S/W order, waypoints at corners; no path means a jump and `unreachableCount` + 1 (R1). |
| `clock.ts` | Estimated server time: newest timestamp seen + client ms ticked since (R2). |
| `actors.ts` | Targets by status (R3), walking actors (R4, R5 reduced motion = jump), draw frame and pose (R4, R8). |
| `overlays.ts` | Per-kind desk/monitor overlays, raised hand, coffee mug and steam (R3, R12). |
| `bubbles.ts` | One coalesced bubble per character for activities new since the last snapshot (R6). |
| `meter.ts` | Context meter fill, size and sweat flag (R7); colour comes from `verdictHex`. |
| `celebrate.ts` | New outcomes, the cheering character, seeded confetti over the done wall (R8). |
| `draw.ts` | Bubble box raster and placement (above the tag, tail at the head, inside 480x270), meter rect under the tag, sweat position (R6, R7). |

`mount.ts` wires it (blocks marked `// #5 office-life`): `rebuild` observes the clock,
passes `nowMs` to `buildScene` (tidy, `scene.ts`), plans targets and syncs the actors,
pushes new activities to the bubbles and starts confetti + a cheer for new outcomes;
`update(dtMs)` (not while paused) ticks the clock, steps the actors, sets `layoutDirty`
every `LAYOUT_EVERY_MS` while someone walks and once when all stop, and once a second
rebuilds for a tidy-due desk or re-plans (idle -> couch); `draw` draws the per-frame copy
of the character items (gone actors left out, pose frames `look:<key>:<pose>`) with their
overlays, then above the light the tags (fixed offset from the rest layout), meters, sweat,
bubbles and confetti. `#office` carries `data-moving` and `data-bubbles` for e2e.

Known gap: the `cto` seat is not reachable on the grid (its foot cell is boxed in by the
CTO desk band and `papers:cto`), so a CTO arriving later jumps to its seat.
