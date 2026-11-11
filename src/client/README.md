# src/client

The browser app: `main.ts` (bootstrap, one mount call per module), `app/` (store, snapshot loader), `render/` (480x270 canvas, integer scale), `ui/` (page shell, overview line). Later: `sprites/`, `office/`.

- **May import:** `src/shared/`, browser APIs, client devDependencies (font package, Vite assets).
- **May not import:** `src/server/`, any Node built-in.
- **Owner:** cycle #0 (skeleton); #2 render/sprites/office, #3 live connection, #5 office life, #6 inspector. `main.ts` is a hotspot (#0).
