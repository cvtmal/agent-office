# replay: plays a recorded fixture set through the live pipeline (--replay); cycle #3.

`bin/agent-office --replay <dir> [--speed N]` (or `make replay DIR=fixtures/replay/harness SPEED=10`) serves a replay set (`fixtures/replay/README.md`) instead of the real config dir (DATA-9, research R8, D-016 c).

- `manifest.ts` — `readManifest(dir)`: reads and validates `<dir>/manifest.json`; a bad field throws `ManifestError` naming it (`files[1].as: expected a set-relative path`). The `Manifest` type is a copy of `fixtures/gen/replay.ts` (server code does not import `fixtures/`); keep the two in step.
- `player.ts` — `startReplay({ dir, speed, root, clock })` → `{ manifest, cfgDir, now, liveness, rootOf, dirOf, done, close }`.
  - Clears and fills `var/replay/<name>-<pid>/` through `var.ts`: `manifest.json`, the repo dirs and every non-transcript file are copied at start, except `files[]` paths and agent `meta.json` files.
  - Virtual clock: `now() = base + min(elapsed × speed, durationMs)`.
  - Every 50 ms (a ref'd timer, cleared when done) it appends each transcript line whose record `timestamp ≤ now()` to the copy's `config/projects/…` (an untimestamped line goes with the line before); an agent's `meta.json` is copied once its last line is played; `files[]` are copied at `appearsAtMs` to `as ?? path` (D-020: `STATE.landed.md` replaces `STATE.md`).
  - `liveness.registry()` holds the `live` windows active at `now()` (`fromMs ≤ t ≤ toMs`, pid `5000 + i`, `procStart` null; never `ps`); `teammates()` is `[]`.
  - `rootOf(cwd)` is the longest `repos[].root` that is `cwd` or a parent of it (else `repoRoot`); `dirOf(root)` is the copy of `repos[].dir` (else `root`).
  - At the end it logs `replay finished`, resolves `done` and holds the final state (no loop).
- Wiring (`cli.ts`): `createLiveSource` gets `cfgDir`, `now` (drives `generatedAt`), `liveness`, `rootOf`, `dirOf` (for the harness cache), `maxAgeHours: Infinity` and `home: manifest.home`; the harness reader runs without `git`, since the copy lies inside this repo. The config file's `projects`/`exclude` filter is not applied to a replay.

Tests: `manifest.test.ts`, `player.test.ts` (injected clock, temp root) and `replay.int.test.ts` (harness set at speed 1000 through the live source: final characters equal `readSet('harness', { live: 'end' })` from `test/replay-set.ts`; a `project` event with two outcomes and phase `W1 landing` after the reveal).
