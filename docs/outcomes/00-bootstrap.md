# #00 bootstrap — outcome (2026-11-11)

## Delivered
A runnable, empty shell of Agent Office. One Node process (`bin/agent-office`, plain `http`, `127.0.0.1` only) serves `GET /api/snapshot` from a generated sample (2 projects, 14 characters, 28 activities) and the client: Vite middleware in `--dev`, `dist/client` otherwise (falls back to dev mode if `dist/client` is missing). The page shows three slots (overview, stage, inspector) on a dark purple background; the stage holds a 480x270 canvas scaled by whole numbers (x2 at 1280x800) and only cleared, and the overview says `Agent Office · 14 characters`. The shared contract (types, constants, validator, tool kinds, verdicts) is in place, with the S2 folder tree, ESLint module boundaries and a server write ban, 119 unit tests, a Playwright smoke test, a CI workflow, module READMEs and `.claude/rules/*.md`.

## Interfaces
- **Types** `src/shared/types.ts`: `Snapshot`, `Project`, `Character`, `LaneRef`, `Lane`, `Activity`, `HarnessExtras`, `Outcome`, `CommitRef`, `FormatHealth`, `ServerEvent` (`snapshot`/`character`/`activity`/`project`), `ServerEventType`.
- **Constants** `src/shared/constants.ts`: `STATUSES`, `ACTIVITY_KINDS`, `VERDICTS`, `CHARACTER_KINDS`, `ROLES`, `LANE_LETTERS` (+ derived types), `THRESHOLDS` (teammate 150k/180k, cto 220k/250k), `THRESHOLD_ENV` (`HARNESS_TEAMMATE_WARN`, `_RECYCLE`, `HARNESS_CTO_WARN`, `_HANDOVER`; names only, not read yet), `CTO_NAME_PATTERN`, `TOOL_KIND`, `BROWSER_TOOL_PREFIXES`, `DRIFT_RATIO`, `DRIFT_WINDOW_LINES`, `ACTIVITIES_PER_CHARACTER` (10), `DEFAULT_PORT` (4477), `MAX_AGE_HOURS`, `POLL_MS`, `SNAPSHOT_VERSION` (1), `SCENE_WIDTH`/`SCENE_HEIGHT` (480/270).
- **Shared functions**: `validateSnapshot(x): string[]`, `isSnapshot(x)`, `validateEvent(x): string[]` (`validate.ts`); `toolKind(tool): ActivityKind` (`tools.ts`); `verdictFor(tokens, role, thresholds?: Thresholds): Verdict`, `roleFor(kind, name): Role` (`verdict.ts`).
- **Server**: `startServer({ port, host?, dev, root?, getSnapshot? }): Promise<{ url, port, close() }>`, `PortInUseError` (`start.ts`); `createRequestHandler(deps: RouteDeps, fallback?: Middleware)`, `sendJson`, `Middleware` (`api/http.ts`); `routes`, `RouteDeps { getSnapshot() }`, `Handler` (`api/routes.ts`); `serveStatic(dir)` (`api/static.ts`); `resolvePort({ flag?, env, laneEnv })`, `parseLaneEnv(text)` (`config/port.ts`); `writeVarFile(rel, data, root?)`, `varDir(root?)` (`var.ts`); `findRepoRoot`, `REPO_ROOT` (`paths.ts`); `loadSampleSnapshot(root?)` (`sample.ts`).
- **Client**: `createStore(initial?)` with `getState`/`subscribe`/`applySnapshot`/`setConnection`/`setUi`, `initialState()`, `AppState` (`app/store.ts`); `loadSnapshot(store, fetchFn?)`, `SNAPSHOT_URL` (`app/api.ts`); `integerScale(w, h)`, `mountCanvas(canvas, container)`, `CLEAR_COLOUR` (`render/canvas.ts`); `statusText`, `mountStatus` (`ui/status.ts`). DOM ids: `#app` (`data-state` loading/ready/error), `#overview`, `#stage`, `#office` (`data-scale`), `#inspector`.
- **Fixtures**: `buildSample()`, `syntheticUuid(seed)` (`fixtures/gen/sample.ts`) → `fixtures/snapshots/sample.json`.
- **Routes**: `GET /api/snapshot` (200 JSON); any other `/api/*` → 404 `Not found`.
- **Commands**: `make install | dev | build | start | stop | lint | test | e2e | fixtures | replay` (replay arrives in #3). `bin/agent-office --port N --dev --open --help`; `--config`/`--replay` exit 2 ("arrives in cycle #3").
- **Env**: port order `--port` > `PORT` > `HARNESS_PORT` (process env, then `.lane.env`) > 4477; an invalid value stops with an error naming its source.

## How to use it
- New endpoint: append one line to `routes` in `src/server/api/routes.ts`; get data through `RouteDeps` (extend the interface), never module globals.
- New sample data: extend `fixtures/gen/sample.ts`, run `make fixtures`, commit the JSON; `test/sample.test.ts` checks it equals the generator output and passes `validateSnapshot`.
- Server file output: only via `writeVarFile` (confined to `var/`); ESLint fails any other `fs` write in `src/server/`.

## Decisions
- `bin/agent-office` is a POSIX `sh` launcher (tsx in a checkout, `dist/` when built), not a Node script: version-proof. Undo: rewrite as `bin/agent-office.js`.
- The sample is generated from code and committed (adds `make fixtures`). Undo: hand-edit JSON and drop the equality test.
- Vite root is the repo root (`index.html` there), watcher ignores `.claude/`, `.rpi-tracking/`, `var/`, `dist/`.
- `tsconfig.base.json` + editor-only `tsconfig.json` besides the shared/node/client gate configs and `tsconfig.build.json` (a solution config would need `composite`).
- `toolKind`, `verdictFor`, `roleFor` live in shared; `verdictFor` takes a widened `Thresholds` type so #1 can pass env values.
- Write-ban exemptions: `src/server/var.ts` and server `*.test.ts` (OS temp dir only).
- Below 480 px wide the stage scrolls at scale 1; no fractional scaling.
- All packages are devDependencies; the canvas clear colour is a placeholder until #2's `palette.ts`.
- Sample details: lane slugs `live-updates`/`inspector`/`project-overview`/`replay-mode` (A–D), agents inherit parent session/cwd/branch/lane, `teamName "harbor"` on CTO and lane sessions, `syntheticUuid` sets only the version nibble.

## Deviations
- Inspector column is 280 px, not the Phase 5 320 px: at 1280x800 320 px left the stage 934 px wide (scale 1); the plan never fixed the width.
- Port: an invalid value does not fall through to the next source; `HARNESS_PORT` from the environment wins over `.lane.env`.
- Static serving also serves `index.html` for a path ending in `/`; non-GET/HEAD and missing files with an extension fall through to `next()`.
- `close()` also drops keep-alive sockets; route handler errors log to stderr.
- Client tests import `sample.json` as JSON (client may not import `node:fs`). Lint-rule tests are 18 cases, not 17 (`var.ts` exemption checked for both rules).
- Phase 9 fix: Vite middleware uses `server.ws` instead of the deprecated `server.hmr` (removed a warning on every `make dev`).

## Carried forward
- `npx agent-office` from the npm registry (publishing, prebuilt `dist/`) — #7.
- SSE `GET /api/events`, config file, `--config`, `--replay`, reconnect — #3 (types and validator exist).
- Threshold overrides from `THRESHOLD_ENV` (names defined, nothing reads them) — #1.
- Known gap: `open`/`openSync` are not in the server write ban (reads need them), so a write via `fs.open(path, 'w')` passes lint — whoever next touches `eslint.config.js` (#1).
- Review F-m1: the write ban also misses destructured calls (`const { writeFileSync } = fs`) — #1, with the `open` gap.
- Review F-m2: `ci.yml` cancels in-progress runs on `main` too, so two quick landings leave the first commit without a result; use `cancel-in-progress: ${{ github.event_name == 'pull_request' }}` — CTO / #7.
- CI has never run on GitHub: the CTO checks the first Actions run after landing (a local Linux simulation passed, see Verification).
- npm 11 warns that the `esbuild` postinstall (and `fsevents`) is not in `allowScripts`; not run, tsx works via `@esbuild/*` optional packages. Revisit with #7 packaging.
- `syntheticUuid` does not set RFC variant bits — fine for fixtures; #1 should not validate fixture UUIDs strictly.

## Verification
- Clean clone of the branch: `make install && make lint && make test` — green (15 files, 119 tests).
- Lane: `make lint`, `make test` (119), `make build`, `make e2e` (2 projects: 1280x800 at DPR 1 and 2) — green, tree clean; re-run green after the Phase 9 fix.
- `make dev` prints `http://127.0.0.1:8001/`; `/api/snapshot` returns the sample; `/api/nope` 404; HMR socket upgrades (101); a second `make dev` prints the port-in-use line; `--replay x` exits 2; `make stop` frees the port.
- Browser (Chrome): page at 1280x800 (checked in a 1280x800 frame, the window could not be resized) — dark purple, three slots (overview 1264, stage 976, inspector 280 px), canvas 480x270 `data-scale="2"` at 960 px, pixelated, `14 characters`, no console errors.
- Review: CI steps simulated on a clean `git archive` of HEAD in `node:22` (linux/amd64, Node 22.23.4, npm 10.9.9): `make install && make lint && make test` — green (119); `actions/checkout@v7` and `actions/setup-node@v7` tags exist.
- Pending for a human: CI run on GitHub.
