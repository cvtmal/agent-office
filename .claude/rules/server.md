---
paths:
  - "src/server/**"
---

# src/server rules

- Import from `src/shared/` and Node built-ins; never from `src/client/` (ESLint enforces it).
- Never write files outside `src/server/var.ts`: use `writeVarFile` (confined to `var/`). ESLint bans `fs` write functions (named imports and `fs.x()` calls) everywhere else in `src/server/`.
- Transcripts and the Claude config dir are read-only, always. No real paths or ids in code, logs or tests.
- Interpretation of transcript records lives in `reader/` as pure functions; file and process access lives in `discovery/`, `live/` and `harness/` (S2 pipeline).
- `api/routes.ts` is owned by #3: other cycles append one route line for their own endpoint. Route handlers get their data through `RouteDeps`, not module globals.
- Listen on `127.0.0.1` only. Ports come from `resolvePort` (`--port`, `PORT`, `HARNESS_PORT`, 4477); in a lane use only the lane's port.
- Unit tests sit next to the code (`foo.test.ts`) and may write only to the OS temp dir (`mkdtemp`); servers in tests listen on port 0 and are closed in `afterAll`.
- Relative imports use the `.js` specifier.
- Record interpretation lives only in `reader/`, which does no IO; `shapeTarget` (`reader/target.ts`) is the only place a tool input becomes text for the API.
