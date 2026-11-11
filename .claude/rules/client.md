---
paths:
  - "src/client/**"
---

# src/client rules

- Import from `src/shared/` and browser APIs; never from `src/server/` or any Node built-in (ESLint enforces it). Client tests load fixtures as JSON imports, not with `fs`.
- The renderer draws only from the store; the store changes only from API messages or UI state. The renderer never fetches.
- `main.ts` is a #0 hotspot: append one mount call for your own module, do not restructure it.
- The canvas is a fixed 480×270 scene, scaled by whole numbers only (`integerScale`); `imageSmoothingEnabled = false` and CSS `image-rendering: pixelated`.
- Colours come from `render/palette.ts` (owned by #2; ask the CTO for a change). `office/layout.ts` is #2's: others add named spots for their own props only.
- HTML panels (`ui/`) style through the CSS variables in `ui/shell.css`.
- Unit tests sit next to the code (`foo.test.ts`); browser checks go in `e2e/` (`make e2e`, 1280×800 and 2×).
- Relative imports use the `.js` specifier.
