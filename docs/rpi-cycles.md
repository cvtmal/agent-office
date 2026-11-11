# Agent Office: RPI cycles

_Last updated: 2026-11-11 (CTO-2: G2/G3 answered) · Source of scope: `docs/scope.md` · Art: `docs/design/art-direction.md` · Who runs it: `docs/harness/CTO.md`_

We are building Agent Office, a local web app that shows the owner's Claude Code sessions and agents as pixel-art characters in an office, with the look of a point-and-click adventure: who is busy, idle or gone, what each one is doing, and how full its context is. It reads Claude Code transcripts read-only and adds harness detail when a repo has it. The scope document is the scope. This file turns it into `/rpi` cycles and sets the order.

One cycle = one slug = one pass through Research → Plan → Implement → Review. A cycle ends with the gates green and exactly one commit on `main`. Cycles are grouped in **waves**: cycles in the same wave depend only on earlier waves, so they run in parallel, each in its own **lane** (git worktree + port).

**Reading guide (context budget).** A session working on a cycle reads: this file from the top down to the end of **Settled decisions**, then the rows of **Requirements** for the IDs in its cycle's overview row (each row names the section of the scope document to read), **Reference material**, its own cycle section, and the outcome files `docs/outcomes/<nn>-<slug>.md` of the cycles in its "Depends on" column. Nothing else from this file, and no section of the scope document beyond those the requirement rows name. Cycles that draw (#2, #5, #6, #7) also read `docs/design/art-direction.md` and look at the four images in `docs/reference-images/`.

## How to run a cycle

The CTO session assigns cycles to teammates (`docs/harness/CTO.md`); a teammate follows `docs/harness/TEAMMATE.md`. The RPI commands come from the `rpi` plugin.

1. `/rpi-research <slug>`: the task description is the cycle's section below plus **Settled decisions**. Cycles marked **Plan** in the overview start at `/rpi-plan <slug>`.
2. Then `/rpi-plan <slug>` → `/rpi-implement <slug>` → `/rpi-review <slug>`. RPI asks for `/clear` between phases. A teammate cannot clear itself, so **a phase boundary is a session boundary**: the CTO ends the teammate and starts a fresh one for the next phase. The artifact on disk is the only handoff.
3. RPI's "the human reviews before `/clear`" checkpoints go to the CTO, never to the owner. The teammate ends each phase with the short report from `TEAMMATE.md`; the CTO accepts it or sends it back.
4. If the review says `Needs Rework`, the cycle re-enters the phase the review names. A cycle counts as done only when its review says `Complete` and its commit is on `main`.
5. The implementation session writes `docs/outcomes/<nn>-<slug>.md`, and the review session corrects it before it lands the cycle, so the file is part of the cycle's commit: interfaces, names, commands, deviations, decisions taken, and what is carried forward. It is the handoff to later cycles, so write it for a reader who has not seen the code. Keep it under 80 lines.
6. The CTO then sets the cycle's row in the overview to `✅ Done`. Only the CTO edits this file.

Artifacts land in `.rpi-tracking/{research,plans,changes,reviews}/<date>/<slug>-*.md` inside the lane's worktree (git-ignored). `bin/harness/lane close` copies them to the main checkout before it removes the worktree.

## Important

- **Never ask the owner to decide.** Apply your own recommendation, record it (research artifact, then the outcome file) and move on. The only exceptions are the **Owner gates** below, and each of those has a default.
- **One commit per cycle**, made by `bin/harness/land`. The subject is `<slug>: <what it delivers>`. Rework after landing goes in a new commit on top. Commit rules: `CLAUDE.md` § Git.
- **The app stays runnable.** After every cycle, `make install && make dev` on a clean checkout starts the app on `http://localhost:4477` (in a lane: the lane's port), and `make lint && make test` are green.
- **Tests are part of the cycle**, not of a later one. Every rule a cycle implements has a test in it.
- **No secrets and no personal data in the repository.** Fixtures are synthetic (S3). Never commit a real transcript, a real session id, a real path under `/Users/`, or anything copied out of `$CLAUDE_CONFIG_DIR`.
- **Read-only towards the machine (scope P-1).** No code in `src/server/` writes outside the repo's own `var/` and the OS temp dir. Tests use fixture directories, never the real `$CLAUDE_CONFIG_DIR`, except the comparisons with `ctx --json` that the scope asks for, which only read.
- **Scope is the scope document.** A cycle that finds a gap writes it under "Carried forward" in its outcome file; the CTO decides whether it becomes a cycle.
- **Visual cycles check what they draw.** A cycle that changes the canvas or the HTML UI starts the app on its lane's port, takes screenshots with the browser tools at 1280×800 and at 2× scale, compares them with `docs/design/art-direction.md` and its checklist, and saves the screenshots it judged under `.rpi-tracking/` (names in the outcome file).

## Running cycles in parallel

1. **One lane per cycle.** `bin/harness/lane open <slug>` creates the worktree `.claude/worktrees/<slug>` on branch `<slug>` from `origin/main` and assigns a lane letter and port. A session enters it with `EnterWorktree` and its `path`. Two cycles never share a working tree, and nobody builds in the main checkout.
2. **Ports.** The app reads its port from `PORT`, else from `HARNESS_PORT` in `.lane.env`, else 4477. Each lane also has its own `var/` (git-ignored) for anything the app or the tests write. Nothing else is shared.

   | Lane | Port |
   |---|---|
   | main checkout (CTO, read-only use) | 4477 |
   | A | 8001 |
   | B | 8002 |
   | C | 8003 |
   | D | 8004 |

3. **Finishing.** After the review is `Complete`: `bin/harness/land -m "<slug>: <subject>"` in the lane. It rebases onto `origin/main`, squashes to one commit, runs the gates (`make lint`, `make test`), and pushes to `main`; if the push is rejected it rebases, tests and pushes again. Then the CTO runs `bin/harness/lane close <slug>`.
4. **Migrations.** None: there is no database. The only shared contract is `src/shared/types.ts` (hotspot row below).
5. **Hotspot files.** Some files are owned by one cycle. Later cycles fill the slots it left and never restructure it:

   | File | Owner | Others may |
   |---|---|---|
   | `.github/workflows/*`, `package.json`, `package-lock.json`, `Makefile`, `tsconfig*.json`, `eslint.config.js`, `vite.config.ts`, `vitest.config.ts`, `playwright.config.ts`, `.gitignore` | #0 | add a dependency or a Makefile target with a one-line reason in the outcome file |
   | `src/shared/types.ts` (the API contract, DATA-7) | #0 | add optional fields, never rename or remove; list them in the outcome file |
   | `src/client/main.ts` (client bootstrap) | #0 | append one mount call for their own module |
   | `src/server/api/routes.ts` | #3 | append one route line for their own endpoint |
   | `src/client/render/palette.ts` | #2 | nothing; ask the CTO for a colour change |
   | `src/client/office/layout.ts` (room template and named spots) | #2 | add named spots for their own props |
   | `fixtures/snapshots/sample.json` | #0 | add characters or fields for their own case, never change existing ones |
   | `CLAUDE.md` § The application, `.claude/rules/*` | #0 | append to their own module's rule file |
   | `docs/rpi-cycles.md`, `docs/harness/*`, `docs/scope.md`, `docs/design/*` | CTO | nothing |

6. **Concurrency.** Four lanes at most. The rebase step and the CTO's attention are the bottleneck beyond that. This plan never needs more than two at once.

## Overview and order of execution

Size is a guess for budgeting sessions: S, M, or L (L may need a mid-phase handoff).

| # | Slug | Wave | Requirements | Depends on | Schema | Gate | Start at | Size | Status |
|---|---|---|---|---|---|---|---|---|---|
| 0 | `bootstrap` | W0 | DATA-7 (types only), RUN-1 (skeleton) | — | creates `src/shared/types.ts` | G1 | Research | M |✅ Done |
| 1 | `transcript-reader` | W1 | DATA-1, DATA-2, DATA-3, DATA-4, DATA-8, DATA-9 (fixtures) | 0 | — | G3 | Research | L |✅ Done |
| 2 | `office-scene` | W1 | OFFICE-1, OFFICE-2, OFFICE-3 | 0 | — | G2 | Research | L |✅ Done |
| 3 | `live-api` | W2 | DATA-5, DATA-7, DATA-9, RUN-1, RUN-2, UI-4 | 1, 2 | — | G3 | Research | L |✅ Done |
| 4 | `harness-extras` | W2 | DATA-6 | 1 | — | — | Research | M |✅ Done |
| 5 | `office-life` | W3 | OFFICE-4, OFFICE-5, OFFICE-6, OFFICE-7 | 3, 4 | — | — | Research | L | Open |
| 6 | `inspector-ui` | W3 | UI-1, UI-2, UI-3, UI-5 | 3 | — | — | Research | M |✅ Done |
| 7 | `polish` | W4 | RUN-3, OFFICE-1 (frame time), §7 Sound | 5, 6 | — | — | Research | M | Open |

### Waves at a glance

```
W0  #0 bootstrap
W1  #1 transcript-reader  ‖  #2 office-scene
W2  #3 live-api           ‖  #4 harness-extras
W3  #5 office-life        ‖  #6 inspector-ui
W4  #7 polish
```

**Critical path:** #0 → #1 → #3 → #5 → #7. Start #1 before #2 in W1.

**Milestones.** After #2: a screenshot of the office with the 14 characters of the sample snapshot (art check, G2). After #3: the office shows the owner's real sessions live, and replay works. After #5: the office is alive (animations, meters, bubbles, done wall). After #7: v1.

**What can move.** #4 can start as soon as #1 lands, without waiting for #2. #6 can research and plan while #5 runs, and can start before #4 lands. #2 does not depend on #1 and can slip without moving the critical path until #3 starts.

**Cut line.** Sound (§7) and the RUN-3 measurements in #7 can land after a first usable version. Everything through #6 is v1.

## Owner gates

Every gate has a default, so no cycle is blocked as a whole. The CTO records answers here and in `docs/harness/DECISIONS.md`.

| ID | Question | Default until answered | Affects |
|---|---|---|---|
| G1 | Where does the repository live? | **Answered by the owner (2026-11-11): a public GitHub repository.** At bootstrap the CTO runs `gh repo create agent-office --public --source . --remote origin` with the logged-in `gh` account, then pushes. If that fails, a local bare repository `../agent-office.git` as `origin`, and the failure goes to the Owner inbox. Because the repository is public, the rule "no secrets and no personal data" is checked by every review before landing. | #0 |
| G2 | Art check (scope §8): does the office look right? | **Answered by the owner (2026-11-11): looks okay, G2 closed; the owner wants to see the finished app running before the final verdict, and the art must stay easy to replace (D-034).** Before: the CTO puts the screenshots of #2 in the Owner inbox, sends one push notification, and continues; no answer within 24 h means go ahead. Feedback that arrives later becomes a `fix-` lane or part of #5. | #5 |
| G3 | Privacy check (scope §8): what may the API show per tool? | **Answered by the owner (2026-11-11): per-tool table approved, `ai-title` and `description` name fallbacks allowed, detail mode allowed as an opt-in (#7, D-034).** Before: #1's outcome file lists the target rule per tool; the CTO puts that list in the Owner inbox. Until answered, the rules of scope P-3 apply and `detailMode` stays off. | #3 |

## Settled decisions

Settled now so that parallel cycles do not each decide them differently. A cycle that finds strong evidence against one records it in its research and continues on the settled path. A settled decision changes only by a CTO edit to this file.

### S1. Stack

- TypeScript (strict) everywhere, ES modules, one npm package (no workspaces). Node ≥ 22.13 at runtime (ESLint 10 needs it; CI uses Node 22); the owner's machine has Node 26.
- **Server:** Node built-ins only (`http`, `fs`, `fs.watch`, `child_process` for `ps`). No web framework. Run in development with `tsx`, built with `tsc` (or `esbuild` if `tsc` output is awkward; #0 decides and records).
- **Client:** Vite, Canvas 2D, plain TypeScript and DOM for the HTML parts. No game engine, no React or other UI framework, no state library: a small store of our own (#0 provides it).
- **One port.** The Node server serves the API and the client. In development it mounts Vite in middleware mode; in production it serves the built client from `dist/client`.
- **Fonts:** a pixel font drawn as code for the canvas; an open-licence pixel font from an npm package (for example `@fontsource/*`) bundled by Vite for the HTML. Nothing is loaded from the network at runtime.
- **Tests:** Vitest (unit and contract tests, `make test`); Playwright for browser checks (`make e2e`, not a landing gate, run by the cycles that draw). ESLint with typescript-eslint plus `tsc --noEmit` (`make lint`).
- **Makefile targets** (created by #0, filled by later cycles): `install`, `dev`, `build`, `start`, `stop`, `lint`, `test`, `e2e`, `fixtures`, `replay` (`make replay DIR=fixtures/replay/harness`). `bin/agent-office` is the CLI entry (RUN-1).
- **Not used:** databases, Docker, PixiJS or any engine, React/Vue/Svelte, CSS frameworks, CDNs, analytics, Claude Code hooks (scope §6).

### S2. Architecture

```
src/shared/    types.ts (API contract), constants (statuses, kinds, verdicts, thresholds); no Node or DOM imports
src/server/    config/  discovery/  reader/ (parse, status, activity, tokens, health)  harness/ (extras)
               live/ (tail, watch, poll)  replay/  api/ (http, routes.ts, sse)  cli.ts
src/client/    main.ts  app/ (store, sse client, connection state)
               render/ (canvas, scaling, palette.ts, sprite sheet, light layer, pixel font)
               sprites/ (palette-indexed grids: characters/ parts, portraits/, props/, tiles/)
               office/ (layout.ts, seats, pathfinding, characters, behaviours, effects)
               ui/ (overview strip, inspector card, controls; HTML)
fixtures/      snapshots/sample.json  replay/solo/  replay/harness/  transcripts/ (small unit cases)  gen/ (generator script)
bin/agent-office
```

- `shared` depends on nothing. `server` and `client` depend only on `shared`, never on each other. Enforced with ESLint `no-restricted-imports`.
- The server is a pipeline: discovery → reader (pure functions over records) → in-memory model → API. Everything that interprets transcript records lives in `src/server/reader/` and is pure and unit-tested; file and process access lives in `discovery/`, `live/` and `harness/`.
- The client renders only from the store, and the store changes only from API messages (snapshot, deltas) or UI state (selection, zoom, toggles). The renderer never fetches. Until #3 lands, the client loads `fixtures/snapshots/sample.json` through the same store entry point, so #2 and #3 meet at one function.
- The canvas loop: fixed-step update at 60 Hz, draw on `requestAnimationFrame`, layers floor → back wall props → y-sorted characters and furniture → light layer → name tags, meters, bubbles. `imageSmoothingEnabled = false`, CSS `image-rendering: pixelated`, integer zoom only.
- Sprites are code: palette-indexed grids in `src/client/sprites/`, packed into one sprite sheet canvas at start-up. Characters are composed from layers (art direction § Characters); a character's look is picked by a stable hash (FNV-1a) of its id.
- Room layout is a fixed 480×270 template per room with named spots (CTO office, desk groups A–D, open desks, kitchen spots, whiteboard, done wall, door) and a walkable grid at 8 px. Characters move along BFS/A* paths between spots.

### S3. Data

- **Ids.** Session: its `sessionId`. Subagent or in-process teammate: `<sessionId>/<agentId>`. Project: the absolute repo root path, sent to the client as-is and shown relative to `~`.
- **Enums** (in `src/shared/`): status `busy | idle | waiting | stopped | ended`; activity kind `read | write | shell | web | delegate | plan | other`; verdict `OK | WARN | RECYCLE | HANDOVER`. Tool-to-kind mapping and thresholds exactly as scope DATA-3 and DATA-4. `bin/harness/ctx` is the reference for status and tokens; when ctx and the scope disagree, follow ctx and record it.
- **Time.** ISO 8601 UTC strings in the API; the client formats local time.
- **Privacy.** The server shapes every `target` (scope P-3) in one function in `src/server/reader/`; the client never receives raw tool input unless `detailMode` is on. A test feeds fixtures containing fake secrets and asserts none reach the API.
- **Snapshot.** `GET /api/snapshot` returns `{ version, generatedAt, projects[], characters[], activities[] }` (last 10 activities per character); SSE events are `snapshot`, `character`, `activity`, `project`. #0 writes these types completely, with every field the scope names, so later cycles only fill them.
- **Fixtures are synthetic.** `fixtures/gen/` writes them from code, shaped after the field list in scope §4. A cycle may look at real transcripts on this machine to match their shape, but nothing from them is committed.
- **Robustness.** The reader never throws on a bad line: it counts it (DATA-8) and moves on. Unknown record types are ignored.

### S4. Done for every cycle

- `make lint` and `make test` green in the lane after the rebase; `make dev` still starts the app.
- New behaviour covered by tests; pure logic by unit tests, the API by contract tests against `src/shared/types.ts`.
- Visual changes checked as described under **Important**, with screenshots named in the outcome file.
- The outcome file written; nothing left unfinished without an entry under "Carried forward".

## Requirements

IDs point into the scope document, which holds the wording. Every cycle also reads scope §3 (Principles).

| ID | Section | Requirement |
|---|---|---|
| DATA-1 | scope §4, §5.1 | Discover sessions of the last 24 h and their subagents, grouped by repo |
| DATA-2 | scope §4, §5.1 | One status per character, worked out as in `ctx` |
| DATA-3 | scope §5.1 | Tool calls become activity events with a kind and a privacy-safe target |
| DATA-4 | scope §5.1 | Context tokens and verdict, same as `ctx` |
| DATA-5 | scope §5.1 | Live updates within 2 s by tailing appended bytes |
| DATA-6 | scope §4, §5.1 | Harness extras: lanes, CTO generation, wave, outcomes, last commit |
| DATA-7 | scope §5.1 | `/api/snapshot` and `/api/events` (SSE) from one shared types module |
| DATA-8 | scope §5.1 | Count parse failures; show "format drift" above 5 % |
| DATA-9 | scope §5.1 | Replay recorded transcripts; two synthetic fixtures |
| OFFICE-1 | scope §5.2 | One canvas, 480×270, integer scaling, 60 fps target |
| OFFICE-2 | scope §5.2 | One room per project with CTO office, desk groups A–D, open area, kitchen, whiteboard, done wall |
| OFFICE-3 | scope §5.2, art direction | Stable layered character looks, interns, name tags |
| OFFICE-4 | scope §5.2 | Status and activity animations, walking along paths |
| OFFICE-5 | scope §5.2 | Context meter above each character |
| OFFICE-6 | scope §5.2 | Speech bubbles for new activities, one at a time |
| OFFICE-7 | scope §5.2 | Whiteboard, done wall, celebration when a cycle lands |
| UI-1 | scope §5.3, art direction | Inspector card for a clicked character |
| UI-2 | scope §5.3 | Overview strip per project |
| UI-3 | scope §5.3 | Zoom, tabs, pause, sound, hide ended; remembered |
| UI-4 | scope §5.3 | Reconnect with backoff, resume from a new snapshot |
| UI-5 | scope §5.3 | Keyboard and screen-reader basics, reduced motion |
| RUN-1 | scope §5.4 | One command starts the server and prints the URL |
| RUN-2 | scope §5.4 | Optional config file with defaults and clear errors |
| RUN-3 | scope §5.4 | Memory and start-up footprint, measured |

## Reference material

- **Scope:** `docs/scope.md`.
- **Art:** `docs/design/art-direction.md` and the images in `docs/reference-images/` (style only, never subject matter).
- **Status and tokens:** `bin/harness/ctx` (Python, in this repo) is the reference implementation of discovery, liveness (`pid_alive`), status and tokens; `bin/harness/ctx --json` is the oracle for the comparisons DATA-2 and DATA-4 ask for.
- **A finished harness run to read (read-only):** `~/code/tanzhaken` (`docs/outcomes/`, `docs/harness/STATE.md`, `.claude/harness/lanes.tsv` if present). Used by #4.
- **Harness files of this repo:** `bin/harness/lane` writes `.claude/harness/lanes.tsv`; its format is the one DATA-6 reads.

## W0 Foundation

### 0. `bootstrap`

- Toolchain as in S1: `package.json` with every dependency the plan needs (Vite, tsx, TypeScript, Vitest, Playwright, ESLint + typescript-eslint, the HTML pixel font package), `tsconfig` for shared/server/client, ESLint config with the S2 import boundaries and a rule that forbids `fs` write functions in `src/server/` outside `var/`, Vitest and Playwright configs, the Makefile targets of S1. Lock file committed.
- Folder skeleton of S2 with a short `README.md` per top-level module stating its job and what it may import.
- `src/shared/types.ts` complete for DATA-7 (snapshot, project, character, activity, harness extras, format health, SSE event union) plus the enums and thresholds of S3; a unit test that `fixtures/snapshots/sample.json` matches the types (runtime validation with a small hand-written guard, no schema library).
- `fixtures/snapshots/sample.json`: one harness project with a CTO, four lane teammates (one per desk group A–D), two interns, two main-checkout sessions, and a second, non-harness project with three sessions; together covering every status, every activity kind and every verdict; outcomes and a wave for the whiteboard. 14 characters in all.
- Server skeleton: `bin/agent-office` and `src/server/cli.ts` start the HTTP server on the port rule of § Running cycles in parallel, mount Vite in development, serve `GET /api/snapshot` from the sample file (replaced in #3), print the URL.
- Client skeleton: `src/client/main.ts`, the store of S2 loading the snapshot from `/api/snapshot`, an empty canvas at 480×270 scaled by an integer, and the page shell (dark purple background, slots for the overview strip, the canvas and the inspector panel).
- CI: `.github/workflows/ci.yml` (GitHub Actions, `ubuntu-latest`, Node 22) runs `make install && make lint && make test` on every push to `main` and on every pull request. No secrets, no deploy. #0 owns the file (hotspot).
- `CLAUDE.md` § The application (commands, module map, conventions) and `.claude/rules/` one file per module (`shared.md`, `server.md`, `client.md`, `fixtures.md`).
- **Done when:** on a clean clone `make install && make lint && make test` pass; `make dev` serves the page on 4477 (or the lane port) with an empty scaled canvas and `/api/snapshot` returns the sample; the import boundaries and the write ban each have a failing-case test or lint fixture.

## W1 Data and look

### 1. `transcript-reader`

- `src/server/discovery/`: config dir resolution (`$CLAUDE_CONFIG_DIR`, else `~/.claude`), find transcripts of the last `maxAgeHours`, subagent transcripts and meta, custom titles, live registry with the pid-reuse guard; group by repo root (worktrees under `.claude/worktrees/` belong to the parent repo) (DATA-1).
- `src/server/reader/`: pure functions from records to status (DATA-2; record whether `waiting` is detectable, and leave it out if not), activity events with kind and shaped target (DATA-3), tokens and verdict with the `HARNESS_*` overrides (DATA-4), parse-failure counts and the drift flag with the newest `version` (DATA-8). Builds the in-memory model in the shape of `src/shared/types.ts`.
- Unit fixtures under `fixtures/transcripts/`, one per status, per kind, per verdict, garbled lines, fake secrets.
- `fixtures/gen/` and the two replay sets (DATA-9 fixtures, no player yet): `fixtures/replay/solo/` (one session, about 10 minutes of activity) and `fixtures/replay/harness/` (CTO plus three teammates in lanes A–C with a `lanes.tsv`, subagents, one cycle landing with an outcome file appearing), with relative timestamps so a player can shift them.
- A comparison script `make compare-ctx` that runs the reader and `bin/harness/ctx --json` on the real config dir and prints differences in status and tokens (read-only; used by DATA-2/4 checks, not a gate).
- The per-tool target rules as a table in the outcome file (input for G3).
- Carried from #0 (CTO, D-007; #1 may edit these #0 hotspots for this): close the server write-ban gaps in `eslint.config.js` (`fs.open`/`openSync` with a write flag, destructured `fs` write functions), each with a failing-case lint test; in `.github/workflows/ci.yml` set `cancel-in-progress` only for pull requests and add `paths-ignore` for `docs/harness/**` and `docs/rpi-cycles.md`.
- **Done when:** every DATA-1/2/3/4/8 rule has a unit test; the fake-secret fixture leaks nothing; `make compare-ctx` shows no difference for the sessions on the machine at the time of the review (or each difference is explained in the outcome file); the generator reproduces the committed replay sets byte for byte.

### 2. `office-scene`

- Read `docs/design/art-direction.md` and look at the reference images first.
- `src/client/render/`: canvas setup, integer zoom, `palette.ts` (the ramps of the art direction), sprite-sheet packing from palette-indexed grids, light layer, pixel font for the canvas.
- `src/client/sprites/`: floor and wall tiles, the room shell (beams, window with an original night skyline), props for every area (CTO corner office with a big desk and lamp, four desk groups with monitors and lamps, open desks, kitchen with coffee machine, couch and plants, whiteboard, done wall with frames, door, shelves, posters, rug, clutter); character parts for at least 8 builds and hair/face/clothes/accessory sets × 6 palettes; intern size; 48×48 portraits from the same parts (used by #6).
- `src/client/office/`: `layout.ts` (the room template and named spots of S2), seat assignment from the store (CTO → corner office, lane letter → desk group, interns next to their parent, others → open desks), stable look per id, name tags, a 2–4 frame idle animation. No walking yet (#5).
- Project tabs whenever there are two or more projects, one room per 480×270 canvas (CTO, D-008; scope OFFICE-2 leaves this to the plan); with the sample, two rooms on two tabs.
- **Done when:** with the sample snapshot the scene shows both rooms (via tabs), every character at its seat with its name tag; screenshots at 1×, 2× and 4× are crisp and pass the art-direction checklist in the reviewer's judgement; the screenshots are in `.rpi-tracking/` and named in the outcome file for G2; frame time with 14 characters is under 16 ms (measured in Playwright).

## W2 Live

### 3. `live-api`

- `src/server/live/`: tail transcripts by appended bytes with `fs.watch` and a 2 s polling fallback; update the model; emit deltas (DATA-5).
- `src/server/api/`: `routes.ts`, `GET /api/snapshot` from the live model (replacing the sample), `GET /api/events` SSE with `snapshot` on connect then `character`, `activity`, `project` deltas; contract tests against `src/shared/types.ts` (DATA-7).
- `src/server/replay/`: `--replay <dir>` and `--speed N` serve a fixture set as if live, by appending its lines to a temp copy over time (DATA-9).
- `src/server/config/`: the optional config file with defaults and clear messages (RUN-2); CLI options `--port`, `--config`, `--replay`, `--open` (RUN-1).
- `src/client/app/`: SSE client, applying deltas to the store, connection state with "reconnecting" and backoff, new snapshot on reconnect (UI-4). The office from #2 now follows live data; characters that appear or leave are placed or removed (walking comes in #5).
- Integration with #4 (CTO, D-016): turn `watchHarness`'s `onChange` (`src/server/harness/watch.ts`) into the `project` SSE delta, inject a cached `harnessOf(root)` into the model options, and map replay roots to the manifest's `repos[].dir`. #3 may also extend the #1-owned replay fixture `fixtures/replay/harness/repo/docs/harness/STATE.md` (through the generator) with a phase line and a landed step (D-020). Also from #4's review (D-021): narrow the `fs` destructure ban in `eslint.config.js` to `VariableDeclarator > :matches(ObjectPattern, ArrayPattern) Property[…]` so destructured function parameters are not flagged, and run harness `git log` with `-c log.showSignature=false`.
- **Done when:** appending a line to a watched fixture reaches the browser within 2 s (Playwright); `make replay DIR=fixtures/replay/harness` plays the run start to finish in the browser; stopping and starting the server recovers without reload; CPU under 5 % with 20 watched 10 MB transcripts (generated in `var/`); every config setting has a test.

### 4. `harness-extras`

- `src/server/harness/`: per project, read `.claude/harness/lanes.tsv`, map sessions to lanes by `cwd` under `.claude/worktrees/<slug>`, read `docs/harness/STATE.md` § Now (CTO generation, phase, wave), list `docs/outcomes/*.md`, `git log -1` on `main` (read-only `git` call). Missing files give empty parts, never errors (DATA-6). Fills the harness fields of the model and the snapshot.
- Re-read on change (watch the files) so a new outcome file reaches the client as a `project` delta.
- Carried from #1's review (CTO, D-015; #4 may edit these #0 hotspots for this): in `.github/workflows/ci.yml` make the concurrency group per commit on push (`ci-${{ github.event_name == 'pull_request' && github.ref || github.sha }}`); in `eslint.config.js` ban nested destructuring of `fs` write functions (`const { promises: { writeFile } } = fs`), with a failing-case lint test.
- **Done when:** unit tests per file, including missing and malformed ones; pointed at `~/code/tanzhaken` the snapshot lists its outcomes (and lanes if `lanes.tsv` exists); pointed at a non-harness repo the snapshot shows sessions only; the harness replay fixture yields lanes A–C and the landed cycle.

## W3 Life and interaction

### 5. `office-life`

- Pathfinding on the walkable grid; characters walk between spots (OFFICE-4: no teleporting), with reduced motion respected (UI-5).
- Status behaviours (OFFICE-4): busy at the desk with one animation per activity kind (reading papers, typing, green terminal glow, globe on screen, handing a folder to an intern, sticky note); idle → coffee at the kitchen, couch after 2 minutes; waiting (if #1 found it detectable) → raised hand; stopped → head on the desk; ended → walks out of the door, desk empty for 5 minutes, then tidied. Desk lamps follow their desk's status through the light layer.
- Context meter above each character, colours per verdict, sweat drops at RECYCLE/HANDOVER (OFFICE-5).
- Speech bubbles: icon + target, 3 s, one per character, bursts coalesced (OFFICE-6).
- Whiteboard with wave and CTO generation; done wall with one framed picture per outcome (`<nn> <slug>`); celebration with confetti and a cheering character when an outcome appears (OFFICE-7).
- A checklist of every animation in the outcome file, each ticked against a replay of the harness fixture.
- Seam with #6 (CTO, D-025): `mountOffice` emits the CustomEvent `office:layout` with each drawn character's box (scene px), which #6's HTML hotspot layer follows. #5 re-emits it whenever characters move or appear, and keeps its edits to `office/mount.ts` and `scene.ts` apart from #6's hooks; whichever of #5 and #6 lands second rebases onto the other. From #6's plan (D-026): when characters move, set `layoutDirty = true` in `office/mount.ts` and reuse `office/boxes.ts` `characterBoxes`; drive animation from mount.ts `timeMs` (pause freezes it) and read reduced motion from `ui.reducedMotion`; colour the meters with `render/verdict-colour.ts`. #6's edits in `mount.ts`/`scene.ts` sit in one block marked "#6 inspector-ui hooks".
- Order with #6 (CTO, D-028): #6 lands before #5. #5 uses #6's `office/boxes.ts`, `render/verdict-colour.ts` and activity icons; its plan puts the steps that need them after a `lane sync office-life` onto #6 (start of implement session 2 at the latest). Only if #6 is not landed by then does #5 create them exactly as #6's plan specifies. #5 may add cases to `fixtures/gen/replay.ts` (owned by #1, also edited by #3) after #3 lands: append new cases (stopped, waiting, kind other, verdicts above OK, a burst), never change existing ones.
- **Done when:** the harness replay shows every item of the checklist (screenshots or a short recording per item in `.rpi-tracking/`); a burst of 20 tool calls in 2 s gives one readable bubble; fixture rows at each verdict show the right meter colour; frame time with 14 characters stays under 16 ms.

### 6. `inspector-ui`

- Inspector card (UI-1) in the style of the character sheet in the art direction: portrait from #2, name, kind, role, project, lane, status, tokens with a coloured bar and verdict, age, cwd relative to the repo, the last 10 activities with icons and times. Opens on click, closes on Esc or click outside; real HTML.
- Overview strip above the canvas (UI-2): per project busy / idle / ended counts, highest verdict, the format drift sign (DATA-8).
- Controls (UI-3): zoom steps, project tabs, pause animations, sound on/off (off by default; the switch only, sounds come in #7), hide ended; remembered in `localStorage` (wrapped in try/catch).
- Keyboard: every control and every character reachable (Tab to cycle characters, Enter opens the card); `prefers-reduced-motion` passed to the renderer (UI-5).
- **Done when:** the card matches `/api/snapshot` for the clicked character (Playwright); the strip's numbers match the snapshot; each control works and survives a reload; keyboard-only use reaches every control.

## W4 Finish

### 7. `polish`

- Footprint (RUN-3): memory with 20 watched transcripts under 150 MB, start-up under 2 s, measured and written in `README.md`; frame time with 12 characters under 16 ms (OFFICE-1), measured.
- A few tiny sounds generated with Web Audio (typing, coffee, landing fanfare), off by default (scope §7).
- `README.md`: what it is, `npx agent-office` / `bin/agent-office`, options, config, replay, privacy and detail mode.
- A full visual pass over the harness replay against the art-direction checklist; fixes for what it finds inside this cycle's size, the rest under "Carried forward".
- From the owner (2026-11-11, D-034): **detail mode is allowed.** Make `detailMode` (config and a CLI flag) actually work: off by default, when on the API may carry raw tool input to the local client, the inspector shows it, the server prints one warning at start-up; with it off, the secrets test still passes unchanged. Replace the "warns and stays off until G3" behaviour from #3 (D-019).
- From the owner (D-034): **the art must stay easy to replace.** Write `docs/design/art-seam.md` (≤60 lines): which modules a new art set or renderer replaces (sprites, sprite sheet, palette, room layout, renderer) and which stay (store, API, `office/life/` logic, UI), with the exact interfaces between them. Fix any place where game logic reaches into sprite or palette internals, if it fits the cycle; else list it under Carried forward.
- Memory: #3 measured 171 MB RSS with 20 × 10 MB transcripts, above RUN-3's 150 MB. Find and reduce the cause, or record the measured value and the reason in the README and the outcome file.
- Weak art carried from #5: faint meter track, neighbouring bubbles over name tags, standing intern head-down pose, typing hands not skin-toned.
- **Done when:** the measurements are in the README and within the limits; a fresh clone runs with the documented commands and only Node installed (RUN-1); the visual pass screenshots are named in the outcome file.

## Out of scope / proposals (not scheduled)

- Everything in scope §6: hooks posting events, controlling agents, remote use, costs, a level editor, mobile.
- Proposals for v2: a hook endpoint for instant `waiting` and tool timing; a "reviewing" pose derived from the RPI phase a session is in (`/rpi-review` in its transcript); day and night following the real clock; a verb-bar style command strip once controlling agents is in scope.
