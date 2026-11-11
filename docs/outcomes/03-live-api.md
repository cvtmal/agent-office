# #03 live-api — outcome (2026-11-11)

## Delivered
The office is now live. A watcher over `<cfg>/projects` and `<cfg>/sessions` (`fs.watch` plus a 2 s poll) tails the transcripts and keeps only the fields the model needs. It rebuilds the snapshot in batches of at most 100 ms, diffs it, and pushes events over SSE at `GET /api/events`. The client connects with its own backoff and shows `reconnecting`. A config file (`--config`, XDG default) sets the config dir, the age limit, and project include/exclude lists. `--replay <dir> [--speed N]` plays a fixture set into `var/replay/` through the same live pipeline, including the #4 harness reveal (D-020). Three Playwright specs cover live, replay and reconnect; the CPU bench measures 1.3 % for 20 × 10 MB transcripts. Phases 1–5 were built by session c03-impl, Phases 6–10 by c03-impl-2.

## Interfaces
- HTTP: `GET /api/events` (SSE: `retry: 2000`, first `event: snapshot`, then `character` / `activity` / `project` deltas, 15 s ping). A removal is sent as a fresh `snapshot` (R3). `/api/snapshot` is unchanged.
- `src/server/live/source.ts`: `LiveSource { getSnapshot(); subscribe(listener) → unsubscribe; close(): Promise<void> }`, `staticSource(snapshot)` and `async createLiveSource({ env, home, config: { claudeConfigDir, maxAgeHours, filter }, cfgDir, now, liveness, rootOf, dirOf, … })`. Test seams: `pollMs`, `readTable`, `harness`.
- `live/`: `createLiveModel`, `diffSnapshots(prev, next) → ServerEvent[]`, `createHarnessCache`, `createTail`, `watchTree`, `filterFor(config)`, `attachStream` / `formatEvent` (sse.ts). `reader/retain.ts`: `retain`, `SELECTORS`.
- `src/server/config/file.ts`: `Config`, `DEFAULT_CONFIG`, `configPath`, `loadConfig({ flag, env, home }) → { config, problems, path }`. `config/glob.ts`: `globMatch`.
- `src/server/replay/`: `readManifest(dir)` / `ManifestError` (manifest.ts) and `startReplay({ dir, speed, root }) → { cfgDir, now, liveness, rootOf, dirOf, manifest, done, close }` (player.ts).
- `src/server/var.ts`: added `appendVarFile`, `copyIntoVar`, `removeVarDir`.
- `src/server/start.ts`: `StartOptions.source?`. `api/routes.ts`: `RouteDeps.source?`.
- Client: `app/apply.ts` `applyEvent(snapshot, event)`; `app/live.ts` `connectLive(store, opts?) → { close() }`, `RECONNECT_DELAYS`; `Connection` adds `'reconnecting'`; `#app[data-connection|data-generated-at|data-last-activity-at]`.
- CLI (`bin/agent-office`): `--config <file>`, `--replay <dir>`, `--speed N` (replay only), `--sample` (static sample source, used by Playwright's webServer); `--port`, `--dev` and `--open` as before. Exit 2 on a bad flag, a bad threshold env or a bad replay set.
- Config file JSON: `claudeConfigDir`, `maxAgeHours`, `projects[]`, `exclude[]` (globs `*` `**` `?`; `~` expanded), `detailMode` (forced `false` until G3). Each problem prints `agent-office: config: <problem>` and the CLI carries on.
- Env: `CLAUDE_CONFIG_DIR` (below the config file's value), `XDG_CONFIG_HOME`.
- Make: `make replay DIR=<set> [SPEED=N]` (default 1) and `make bench-live` (not a gate).
- Fixtures: `Manifest.files[].as?` (the file it replaces when it appears). The harness set gains `STATE.landed.md`, which appears at 551 000 ms as `STATE.md`, and the `- Phase:` line.

## How to use it
- New server data: extend the snapshot built in `src/server/live/model.ts` (`buildSnapshot` inputs). `diffSnapshots` turns the change into events with no further work, and the client folds them with `applyEvent`.
- New page state from the stream: read `store` (fed by `connectLive` in `src/client/app/live.ts`). Do not open a second EventSource.
- e2e against a live server: `e2e/helpers/server.ts` (`freePort`, `startCli`, `tempConfig`). It never reads the real config dir.

## Decisions
- Research R1–R14: retained records, not full text (R1); deltas by diffing snapshots (R2); a removal is a fresh `snapshot` (R3); 100 ms batches (R4); `fs.watch` with a 2 s poll (R5); async `ps`, only on registry change (R6); quiet teammates stay (R7); replay through a `var/` copy (R8); `--sample`, config file, CLI (R9–R11); the SSE wire (R12); client backoff 1/2/4/8/15 s (R13); bench (R14).
- Plan: P-1 handoff after Phase 5. P-2 `/api/events` always exists (static source for `--sample`; undo: branch in `main.ts`). P-3 `RouteDeps.source`. P-4 D-020 through `files[].as` (undo: drop `as` and `STATE.landed.md`). P-5 live e2e specs on `freePort()`. P-6 a harness watcher on every root.
- `**` matches whole path segments: `a/**` matches `a`, so `**/vendor/**` excludes a cwd that is exactly `…/vendor`.
- The config is loaded on every run, `--sample` included. A non-object or unreadable file gives one problem and the defaults. A project emptied by `exclude` is dropped; a project that started with no characters is kept.
- Replay passes the harness reader a commit lookup that returns null, because the copy sits inside this repo. The config filter is not applied in replay.
- The client rebuilds `{ type, data }` from the SSE event name. Deltas that arrive before a connection's own snapshot are dropped. The client calls one `applySnapshot` per animation frame.
- `data-last-activity-at` (the latest `lastActivityAt`) was added so the e2e test can see that an append reached the browser; see Deviations. Undo: remove the attribute and assert in another way.

## Deviations
- `src/client/main.ts`: the line `void loadSnapshot(store);` was replaced by `connectLive(store);` instead of a new line being appended (D-017). `api.ts` stays, used only by its own test.
- `playwright.config.ts`: the webServer runs with `--sample`.
- Step 9.2: the plan asserted that `data-generated-at` changes after an append. Deltas carry no `generatedAt`, so the attribute changes only on a full snapshot. The test asserts `data-last-activity-at` instead; contract and server are unchanged.
- The harness integration test compares with `readSet('harness', { live: 'end' })`, because reviewer `c01-review` is `gone` at the end.
- Test-side changes:
  - `startCli` always passes `--dev`.
  - The reconnect spec mocks Vite's HMR socket, because a real one reloads the page.
  - The new-session e2e record needs an assistant record with usage.
- Dependencies: none added. `vitest.config.ts` includes `*.bench.ts` only with `BENCH=1`.

## Carried forward
- Replay copies under `var/replay/<set>-<pid>` are not removed when the process exits; only a later run with the same pid clears one. → #7 (or a fix lane).
- No removal event type (R3) and no `generatedAt` on deltas. → CTO, contract, if a consumer needs them.
- Walking in and out on appear/leave, and stale `busy` (#5). The inspector reads the stream through `store` (#6). RUN-3 uses the bench RSS of 178 MB (#7).
- `detailMode` stays off until the owner answers G3. `ResizeObserver` loop note: still open (outcome 02).
- Minor review finding, not scheduled: replay copy not removed on exit (`src/server/replay/player.ts:102`, same as the first item).

## Verification
- `make lint` pass. `make test` pass (85 files, 1024 passed, 1 skipped). `make build` pass. `make e2e` pass (11 passed, 3 skipped by design). `make fixtures` leaves `fixtures/` clean.
- The new specs `live`, `replay` and `reconnect` passed 3× in a row. `make bench-live`: CPU 1.32 % (user 342 ms + system 57 ms over 30.2 s wall), RSS 178 MB, start-up 1.3 s.
- Privacy: `git grep -nE '/Users/|claudep' -- src test e2e fixtures` finds only the two guard tests. A new contract test checks that no fake secret reaches `/api/events`.
- Browser (Chrome, desktop, port 8003): `make replay DIR=fixtures/replay/harness SPEED=30` played to `replay finished`. It ended with 6 characters, phase `W1 landing` with 2 outcomes, done-wall frames 00 and 01, and c01-review standing ended. The replay spec saved screenshots at 1280×800 2× and 4× (in `.rpi-tracking/screens/live-api/`).
- Review (c03-review) re-ran `make lint`, `make test`, `make e2e` (11 passed) and `make bench-live`: CPU 1.45 %, RSS 171 MB. Privacy sweep of the diff: no real paths, ids or config-dir content; `var/` untracked. On the real config dir (read-only), `/api/events` on 8003 delivered `character`, `activity` and `project` deltas from live sessions.
- Pending human verification: the real office in the browser following activity within 2 s; `--open` on macOS; a full speed-1 replay (12 min).
- Phone widths: not applicable. This cycle adds no layout.
