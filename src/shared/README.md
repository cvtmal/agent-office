# src/shared

The API contract between server and client: `types.ts` (snapshot, characters, activities, server events), `constants.ts` (statuses, kinds, verdicts, thresholds, env names), and small pure helpers (`toolKind`, `verdictFor`/`roleFor`, `validateSnapshot`/`validateEvent`).

- **May import:** other files in `src/shared/` only.
- **May not import:** `src/server/`, `src/client/`, any Node built-in (`node:*`, `fs`, `path`, ...) or the DOM.
- **Owner:** cycle #0. `types.ts` is a hotspot: later cycles add optional fields only, never rename or remove.
