# The art seam

Where the office's art ends and its logic begins, for anyone making a new art set
(other sprites, other palette) or a new renderer. Paths are under `src/client/`.

## What a new art set or renderer replaces

- `sprites/**`: the families in `FAMILIES` (`registry.ts`), each a `Family` of `SpriteDef`s
  (`sprites/types.ts`); `composeCharacter`, `composeIntern`, `portraitFor`; `POSE_FRAMES`.
- `render/**`: the atlas (`createAtlas`), `palette.ts`, the font, the light canvases.
- `office/layout.ts`: `SPOTS`, `PROPS`, sprite sizes (`spriteSize`), `characterFrame`.
- The draw parts of `office/mount.ts` (`draw`, `registerLooks`, `registerLife`,
  `drawOverlays`, `drawLifeTop`), `office/tags.ts` and `office/life/draw.ts`.

## What stays

- `app/**` (store, snapshot loader, live connection), `src/shared/` and the server API.
- `office/life/` except `draw.ts`: actors, paths, bubbles, meter, celebration, overlays.
- `office/scene.ts` seating (`buildScene`, `assignSeats` in `seats.ts`) and `ui/**`.

## The interfaces

- **Art ids** (`office/art-ids.ts`): the names logic asks the art for. Pose frames
  `WALK_FRAME_NAMES`, `HEAD_FRAME`, `CHEER_FRAME_NAMES`; overlay sprites `LIFE_IDS`
  (`life-*`); palette names `ART_COLOURS` (confetti, wall ink and paper, meter track).
  `office/art-ids.test.ts` fails if any of them is missing from `POSE_FRAMES`, from
  `spriteById` or from the palette. Change ids there, never as strings in logic.
- **Atlas ids** built in `office/mount.ts`: `look:<key>:<frame>` (`lookSprite`, frame
  0-3 idle or a pose name), `tag:<text>` (`tagSprite`), `wall:<text>:<w>:<dx>` (wall
  texts), `<id>@<theme>` (a theme recolour), `<id>@<skin>` (life hands per skin ramp).
  Activity icons are sprites `icon-<kind>` (`iconId`, `ICON_SIZE` = 8).
- **Geometry**: `characterFrame(spot, intern)` gives the rectangle a character stands
  in; logic finds spots by name in `SPOTS` (`kitchen-*`, `couch-*`, desks) and props by
  slot in `PROPS` (`monitor:`, `desk:`, `keyboard:`, `desk-top:`).
- **Verdict colours**: `VERDICT_COLOUR` / `verdictHex` (`render/verdict-colour.ts`).
- **Inspector**: `ui/inspector.ts` draws `portraitFor(look, intern)` and the icon sprites.
- **Layout event**: `office:layout` (`LAYOUT_EVENT`, `office/boxes.ts`) tells the UI where
  each character's box is; a renderer must keep emitting it.

## Couplings kept on purpose

- Pixel offsets that assume today's sprite shapes: `deskAnchor` and the hand, mug,
  terminal, globe and folder offsets in `office/life/overlays.ts`; `meterRect` and
  `sweatAt` in `office/life/draw.ts`; `CERT` in `office/scene.ts` (a 16x12 frame).
- `office/layout.ts` imports `spriteById` to size props from their sprites.
- `sprites/life/index.ts` still exports `LIFE_SPRITES`, its `SpriteDef[]`; the office's
  id map of the same sprites is `LIFE_IDS`.

## How to swap

1. Keep every id in `office/art-ids.ts`, or change it there and in the sprites together.
2. Provide a `Family` for each sprite group and list it in `FAMILIES`.
3. Keep `characterFrame` sizes, or move the offsets listed above with them.
4. Swap colours in the sprites' keys; add a palette name only through `render/palette.ts`.
5. Run `make test`: `art-ids.test.ts` and the family tests name what is missing.
