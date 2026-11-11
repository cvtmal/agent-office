# Agent Office: art direction

_Status: settled with the owner · 2026-11-11 · Reference images: `docs/reference-images/`_

The office should feel like a scene from a late-80s / early-90s point-and-click adventure: a handcrafted, cluttered, lived-in room at dusk, lit by warm lamps, with characters who have personality at a glance. It must never look like a dashboard with sprites on top.

## The reference images

Use them **only for style**: pixel density, light, colour and charm. Their subjects (DJs, bedrooms, the German verb bar, the city skyline, the names) are irrelevant and must not be copied. Every sprite in this project is original (scope P-6).

| File | What to take from it |
|---|---|
| `room-attic-nerd.jpeg` | Room composition: a slanted attic ceiling with beams, a back wall full of props (shelves, posters, plants, a lamp), a floor with a rug and clutter, a night window. Warm lamp pools against a cool purple night. A character standing in the scene at about a third of its height. |
| `room-attic-neon.jpeg` | The same room language with a different personality: neon accents (magenta, cyan), fairy lights, plants. Shows that one layout can carry a different mood through props and accent colours, which is how rooms per project should differ. |
| `character-sheet.jpeg` | Character design: stocky, readable silhouettes; strong accessories (glasses, headphones, a cap, hoops) that tell characters apart; a cream-bordered dark panel with a portrait, a name, a role line and coloured bars. The inspector panel copies this structure (portrait, name, role, bars for context and activity). |
| `character-closeup.jpeg` | Shading detail: 2–3 tone ramps per material, dark outlines broken by light, a soft ellipse shadow under the feet. |

## Rules

- **Resolution.** The scene is 480×270 internal pixels, scaled up in whole-number steps with no smoothing. Tiles 16×16. Everything is drawn at that grid; no sub-pixel positions, no rotated sprites, no blurred scaling.
- **Characters.** Frames of 32×48 pixels, the figure about 22–26 wide and 40–46 tall: big head (about a quarter of the height), stocky body, readable at 1×. Built paper-doll style from layers (build, skin, hair, face extras such as glasses or a beard, top, trousers, shoes, accessory such as headphones or a cap), each with its own colour ramp, so that a few parts give many distinct people. Soft dark ellipse shadow under the feet. Interns (subagents) use the same parts at about 24×36.
- **Portraits.** 48×48 head-and-shoulders portrait per character, built from the same layers, shown in the inspector card.
- **Palette.** About 32 colours, defined once in `src/client/render/palette.ts` as ramps: night (deep purple to lavender, for walls, shadows and outlines), wood (3–4 browns), lamp (amber to cream), skin (3 ramps), cloth accents (green, blue, magenta, orange), neon (magenta, cyan) and screen glow (green, blue). No pure black and no pure white; the darkest colour is a near-black purple.
- **Light.** The room is dim purple with warm pools: desk lamps, the coffee machine, the CTO's lamp, the glow of monitors on faces. Draw light as a separate layer composited over the scene, so a lamp can switch with its desk's status. The window shows a night sky with a generic, original skyline.
- **Props make the room.** Each area gets clutter that says what it is: shelves with folders and binders, plants, posters, sticky notes, cables, mugs, a rug, a whiteboard, framed pictures on the done wall, a couch and a coffee machine in the kitchen. Rooms of different projects swap accent colours and a few props (the neon versus the nerd room).
- **Outline and shading.** Coloured outlines (darkest tone of the ramp, not black), 2–3 shading tones per material, light from the lamps (upper left by default).
- **Motion.** Small and alive: 2–4 frame idle breathing, typing hands, steam from mugs, a blinking cursor, a flickering monitor. Walking is 4–6 frames. Movement follows `prefers-reduced-motion` (scope UI-5).
- **Text.** In the canvas: a pixel font drawn as code (name tags, bubbles, whiteboard). In HTML (overview strip, inspector card, controls): the same dark-purple panel with a cream 1-pixel border as the character sheet, set in a bundled open-licence pixel font served locally (scope P-2).

## Checklist for the art check (owner gate)

A screenshot of the sample snapshot at 2× passes when:
1. It reads as a room with a mood (night, lamps), not as a grid of icons.
2. Twelve characters can be told apart without reading their name tags.
3. The CTO's corner office, the four desk groups, the kitchen, the whiteboard and the done wall are recognisable without labels.
4. Pixels are crisp at 1×, 2× and 4×.
