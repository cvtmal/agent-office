# src/server

The local Node server: `cli.ts` (arguments, port, start), `start.ts` (one `http` server, Vite middleware in `--dev`), `api/` (request handler, `routes.ts`, static files), `config/` (port resolution), `var.ts` (the only place that writes files, under `var/`). Later: `discovery/`, `reader/`, `live/`, `harness/`, `replay/`.

- **May import:** `src/shared/`, Node built-ins, devDependencies.
- **May not import:** `src/client/`; `fs` write functions anywhere except `var.ts` (and tests, which write to the OS temp dir).
- **Owner:** cycle #0 (skeleton); #1 discovery/reader, #3 live/replay/API, #4 harness. `api/routes.ts` is owned by #3.
