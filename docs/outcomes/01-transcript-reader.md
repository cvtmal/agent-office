# #01 transcript-reader — outcome (2026-11-11)

## Delivered
The server's data side. `discovery/` reads the Claude config dir and the process table (read-only): session and subagent transcripts of the last 24 h, the live registry (`sessions/<pid>.json`, pid-reuse guard) and running teammates (`ps`). `reader/` turns that into a `Snapshot` with pure functions: one status per character (DATA-2), privacy-shaped activities (DATA-3), tokens and verdicts with `HARNESS_*` overrides (DATA-4), per-project format health (DATA-8), worktrees grouped under their main repo (DATA-1). `scanSnapshot()` is the one entry; it is **not routed** (`/api/snapshot` still serves the sample). Synthetic unit fixtures, two replay sets with a byte-for-byte generator (DATA-9 fixtures; no player), `make compare-ctx`, and the D-007 lint/CI carry-over. No new dependency; `src/shared/types.ts` unchanged.

## Interfaces
- `src/server/snapshot.ts` `scanSnapshot({ env?, home?, now?, maxAgeHours?, table?, rootOf? })` → `{ snapshot, liveBy }`; throws `ThresholdEnvError { variable, value }` on a bad threshold env value.
- `src/server/discovery/index.ts` `discover({ cfgDir, now, maxAgeHours, table })` → `Discovered { sessions, agents, registry, teammates }`; also `configDir`, `readProcessTable`, `liveRegistry`, `teammateProcs`, `repoRoot`, `whereIn`, `displayPath`.
- `src/server/reader/model.ts` `buildModel(discovered, { now, home, thresholds, rootOf })` → `{ snapshot, liveBy: Map<sessionId, 'registry'|'teammate'> }`; `buildSnapshot` (snapshot only). Building blocks per file: `src/server/reader/README.md`.
- Env: `CLAUDE_CONFIG_DIR`; `HARNESS_TEAMMATE_WARN`, `HARNESS_TEAMMATE_RECYCLE`, `HARNESS_CTO_WARN`, `HARNESS_CTO_HANDOVER` (read once per scan; empty or non-integer → error naming the variable).
- Make: `fixtures` now also runs `fixtures/gen/transcripts.ts` and `fixtures/gen/replay.ts` (reason: they generate committed fixtures; `test/fixtures.test.ts` checks the bytes). New `compare-ctx` (reason: `docs/rpi-cycles.md` §1 asks for it; read-only, not a gate).
- Fixtures: `fixtures/transcripts/{cases,config,ps.txt}`, `fixtures/replay/{solo,harness}/` with `manifest.json` (`base`, `durationMs`, `home`, `repos`, `live` windows, appearing `files`; layout in `fixtures/replay/README.md`).

## How to use it
- #3: route `scanSnapshot()` into `/api/snapshot` (`src/server/snapshot.ts`); tailing/watching replaces the full re-read in `discovery/files.ts`.
- #3 replay player: read `fixtures/replay/<set>/manifest.json`, show records up to `base + t`, build `Discovered.registry` from the `live` windows (`test/fixtures.test.ts` `readSet` shows how) and reveal `files` at `appearsAtMs`.
- #4: add harness facts beside `buildModel`; `liveBy` tells which sessions are live because of a teammate process.

## Per-tool target table (G3; P-3 rules, `detailMode` off)
Every target comes from one string field; missing or non-string → `""`; whitespace (incl. newlines) → one space, other control characters removed, max 40 characters. Never a prompt, content, pattern, query, description or result.

| Tool | Target |
|---|---|
| Read, Write, Edit / NotebookEdit / LSP | basename of `file_path` / `notebook_path` / `filePath` |
| Grep | basename of `path`, else `""` (never the pattern) |
| Glob | last segment of `pattern` |
| Bash, Monitor | first word of `command` after `VAR=value` tokens, basename; shown only if `[A-Za-z0-9._+-]{1,40}` (P1) |
| WebFetch; browser tools (`mcp__claude-in-chrome__*`, `mcp__playwright__*`) | host of `url`; browser without a URL: `action` if `[a-z_]{1,24}` |
| WebSearch, TodoWrite, unknown tools | `""` |
| Agent / SendMessage / Skill / Workflow | `subagent_type`, else `name` / `to` / `skill` / `name`; identifiers only (`[\w.:@/+-]{1,40}`, P1) |

Names are the free-text fields shown, cut to 40 characters: an agent's name may be its meta `description` (P6); a session without registry name, custom title or agent name falls back to its newest `ai-title` record (a title Claude Code generates from the conversation, as `ctx` does; `reader/names.ts`).

## Decisions
- P1 narrow character classes for shell words and identifiers (undo: drop the regexes in `reader/target.ts`). P2 assistant record without `end_turn`/`tool_use` = busy. P3 titles searched in the whole file. P4 one `ps` per scan for pid reuse and teammates. P5 teammate transcript older than 24 h dropped. P6 agent name may be the meta description. P7 character without a cwd dropped. P8 replay sets carry `manifest.json` live windows, no registry files.
- D2 `waiting` is real but only from the registry (registered sessions); never for agents, teammates or the transcript rule; `waitingFor` not exposed.
- CTO decision: `clean()` turns `\n`, `\t` and other whitespace into one space (words never merge); other control characters are deleted.
- `LiveBy` lives in `reader/status.ts`, re-exported by `model.ts`. `liveBy` holds every registry entry and teammate match, kept or not. A live session without usage is kept with 0 tokens.
- Replay sets: CTO named by a `custom-title` record; teammate B ends mid-tool call and C on a thinking record (busy at the end); solo's one `Agent` call has no subagent transcript.

## Deviations
- D3: a teammate is live when a running `claude --agent-name X --team-name Y` matches its newest transcript; `bin/harness/ctx` says `ended` for these. `compare-ctx` counts it as explained.
- `thresholdsFromEnv` does not trim and treats an empty value as an error (ctx treats empty as unset).

## Carried forward
- P5 quiet-teammate gap → #3. Stale `busy` agents (`SubagentHandback` as a finished signal) → #5. `ctx` shows live teammates as `ended` → CTO (harness file). P6 description-as-name → owner via G3.
- Full re-read per scan; no tailing or watch → #3.
- CI `ci.yml` (PR-only cancel, `paths-ignore`) unverified until the first Actions run → CTO.
- Review F-m2: on `main` a third push while one run is in progress still cancels the *pending* run (GitHub keeps one pending run per concurrency group); fix with a per-commit group on push (`ci-${{ github.event_name == 'pull_request' && github.ref || github.sha }}`) → CTO / #7.
- Review F-m3: nested destructuring (`const { promises: { writeFile } } = fs`) passes the write ban → whoever next touches `eslint.config.js`.
- Review F-m1: `ai-title` as a session-name fallback is model-generated text; G3 may drop it (`reader/names.ts`) → owner via G3.

## Verification
- `make lint` 0; `make test` 0 (33 files, 356 tests); `make fixtures` leaves the tree clean; `test/fixtures.test.ts` fails on a hand-edited fixture; `fixtures/replay` 212 KB.
- `make compare-ctx` (this machine, at implement time): `26 match, 8 explained, 0 mismatch, 0 only-ctx, 0 only-reader`; rerun at review: `28 match, 7 explained, 0 mismatch, 0 only-ctx, 0 only-reader`. Every explained row is ctx `ended` against our `idle`/`busy` (review: 2 sessions, 5 agents) whose session or parent session is live only through a teammate process (D3).
- Review: privacy sweep of the branch diff — no real session/agent id (checked against every transcript id in the config dir), no real path, no key-shaped secret.
- `make dev` on 8001: `/api/snapshot` still serves the sample; `make stop` done. No pages changed, so no browser check.
- `git grep '/Users/|claudep' -- fixtures src test`: only the two tests that check for it.
- Pending a human: the CI behaviour of `ci.yml` (first Actions run after landing).
