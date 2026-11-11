# #4 harness-extras — outcome (2026-11-11)

## Delivered

`src/server/harness/` reads a project's harness state, read-only: `lanes.tsv`, `docs/harness/STATE.md` § Now (CTO generation, phase, wave), the names of `docs/outcomes/*.md`, and the last commit on `main` (one `git log -1`). A missing or garbage file gives an empty part, never an error; a directory with none of the three harness files gives `null` and no git call. A poll-based watcher calls back when the harness data changes. The model now fills `project.harness` (through an injected `harnessOf(root)`) and `character.lane` (by matching the session's `where` against `.claude/worktrees/<slug>`). The two D-015 fixes are in: per-commit CI concurrency group on push, and the ESLint ban now catches nested destructuring of `fs` write functions. No new dependency; `src/shared/types.ts` and `sample.json` unchanged.

## Interfaces

- `src/server/harness/parse.ts` (pure): `WORKTREE_PREFIX = '.claude/worktrees/'`, `parseLanes(text): Lane[]`, `parseStateNow(text): { ctoGeneration, phase, wave }`, `parseOutcomeNames(names): Outcome[]`, `parseGitLog(stdout): CommitRef | null` (format `%H\0%s\0%ct`), `laneSlugOf(where): string | null`, `laneOf(where, harness): LaneRef | null`.
- `src/server/harness/read.ts`: `type GitLog = (dir) => string | null`, `gitLastCommit(dir)` (read-only `git -C dir log -1 … main --`, 3 s timeout, `GIT_OPTIONAL_LOCKS=0`; failure → `null`), `readHarness(dir, { git? }): HarnessExtras | null`.
- `src/server/harness/watch.ts`: `watchHarness(dir, onChange, { pollMs = POLL_MS, debounceMs = 100, read = readHarness }): { close() }`.
- `src/server/harness/index.ts` re-exports all three.
- `src/server/reader/model.ts`: `ModelOptions.harnessOf?: (root) => HarnessExtras | null` (default `() => null`), called once per distinct root per build.
- `src/server/snapshot.ts`: `ScanOptions.harnessOf?` (default `readHarness`).
- `src/server/reader/target.ts`: `clean(s, max = MAX_TARGET)` (new optional `max`; callers unchanged).
- `eslint.config.js` destructure-ban selector `VariableDeclarator ObjectPattern > Property[…]`; `.github/workflows/ci.yml` concurrency group per commit on push.

## How to use it

- Live updates (#3): `watchHarness(root, (h) => emit({ type: 'project', project: { ...p, harness: h } }))`; the callback does not fire at start, so read the initial value with `readHarness(root)`.
- A cached reader (#3): pass `scanSnapshot({ harnessOf: (root) => cache.get(root) ?? null })`, filled by the watcher.
- Lane of a session anywhere else: `laneOf(where, harness)` from `src/server/harness/parse.ts`.

## Decisions

- PL1 `clean()` got an optional `max` instead of a second copy of its rules in `harness/`. Undo: a local helper in `parse.ts`.
- PL2 `laneOf`/`laneSlugOf` live in `harness/parse.ts` (pure); `reader/model.ts` imports them. Undo: move them to `reader/`.
- PL3 `buildModel` memoises `harnessOf` per root inside one build only; no cache across scans (left to #3).
- PL4 `harnessOf` defaults to `() => null` in `buildModel` (pure, existing tests unchanged) and to `readHarness` in `scanSnapshot`.
- PL5 the watcher's first check records a baseline and does not call `onChange`.
- Phase text: markdown emphasis stripped, then `clean(s, 80)`; commit subject `clean(s, 120)`.
- `lanes.tsv`: malformed rows skipped, first row per slug wins, sorted by letter.

## Deviations

- The watcher reads the value once at start to have a baseline for comparison (still no `onChange` at start).
- The debounce timer is `unref()`'d too, like the poll interval.
- Watch tests wait on events (`vi.waitFor`, 10 s; per-test 30 s), not sleeps, for slow CI; the "after close" case waits until a second open watcher has seen the change.
- The real-git test sets `GIT_CONFIG_NOSYSTEM=1` and `GIT_CONFIG_GLOBAL=/dev/null` so no user git config can affect it.

## Carried forward

- #3: route `scanSnapshot` into `/api/snapshot`, SSE `/api/events`, `project` events from `watchHarness`, a watcher-backed cached `harnessOf`.
- #3: the replay player reveals `fixtures/replay/harness/repo/` files at `appearsAtMs`.
- CTO / #3: the #1-owned fixture `fixtures/replay/harness/repo/docs/harness/STATE.md` has plain labels, no phase line and no "(landed)" step; not edited here.
- Later: `lastCommit` is `null` for repos whose default branch is not `main` (scope says `main`).
- CTO, after landing: M3, check on GitHub Actions that push runs use a per-commit concurrency group.
- Review F-m1 (fix lane or #3): the widened ESLint destructure ban also flags parameter destructuring inside an initialiser (`const f = ({ writeFile }: Deps) => …`). Narrow it to the declarator's own pattern, e.g. `VariableDeclarator > :matches(ObjectPattern, ArrayPattern) Property[…]`, with an allowed-case lint test.
- Review note (#3 or #7): `gitLastCommit` could pass `-c log.showSignature=false` so a repo's own git config cannot start a signature program during the scan.
- Seen in the real scan: one other local project has harness files and reads as generation 0, 0 lanes, 0 outcomes; not investigated (outside this repo). #6 can decide how an empty harness looks.

## Verification

- `make lint` 0 · `make test` 0 (36 files, 400 tests; re-run after Phase 5) · `make fixtures` 0 and `git status --short fixtures` empty.
- Per-file: `parse.test.ts` + `target.test.ts` 69 pass; `read.test.ts` 7; `watch.test.ts` 5 (3 runs in a row, ~0.9 s each); `model.test.ts` 10; `lint-rules.test.ts` 28 (fails with the old selector, as required).
- M1 tanzhaken (read-only): 19 outcomes (0 … 18), 0 lanes, generation 4, wave `null`, phase set, `lastCommit` with a 40-hex sha and an `at` ending in `Z`.
- M2 real scan: non-harness temp dir → `null`; 6 projects, 4 without harness files → `harness: null`; this repo → lanes A–C, 2 outcomes, generation 1, wave W1; tanzhaken → 19 outcomes; 25 of 256 characters carry a lane (A harness-extras, B office-scene, C live-api).
- `make dev` on 8001 starts; `curl localhost:8001/api/snapshot` answers 200 with the sample (2 projects, 14 characters; routing is #3's); `make stop` freed the port.
- No pages to check in a browser (no UI change). Pending a human/CTO: M3.
