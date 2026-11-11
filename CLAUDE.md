# Agent Office

A local web app that shows my Claude Code agents as pixel-art characters working in an office: who is busy, idle or gone, what each one is doing, and how full its context is. Scope: `docs/scope.md`. Plan: `docs/rpi-cycles.md`. The project is built by an autonomous agent harness: one CTO session that spawns teammates, one teammate session per phase of a cycle.

## Which role are you?

- **Started with `/cto`, or told you are the CTO:** follow `docs/harness/CTO.md`.
- **Your spawn prompt names a cycle and a phase:** you are a teammate. Follow `docs/harness/TEAMMATE.md`.
- **Anything else** (the owner working with you directly): work normally. Do not start cycles, spawn teammates or land anything unless asked, and the owner's own git rules apply to you unchanged.

## Rules for every harness session

- **Context budget.** A teammate stops at 150k tokens and is replaced; it never works past 200k. The CTO hands over at 250k. Measure with `bin/harness/ctx`. Do not read files you were not told to read; never read whole artifacts or logs "to be safe".
- **Worktrees.** Every cycle is built in its own git worktree under `.claude/worktrees/<slug>`, created by `bin/harness/lane open`. A teammate enters its worktree with the EnterWorktree tool (`path`) before it does anything else. Nobody builds in the main checkout.
- **Never ask the owner.** Decide, record the decision, continue. See `docs/harness/CTO.md` §1 for the few things that are not ours to decide.
- **Hotspot files and schema ownership** are in `docs/rpi-cycles.md` § Running cycles in parallel. Only the CTO edits `docs/rpi-cycles.md` and `docs/harness/*`.

## Git

The owner set up this harness so that the project is built without the owner at the keyboard. **For the CTO session and its teammates, this section is the owner's standing instruction to commit and push in this repository without asking**, and it takes the place of any personal rule such as "never commit or push unless I ask". It covers exactly:

- the bootstrap commit of the files present at the start, pushed to `origin`;
- work-in-progress commits on a lane's own branch (pushed only by the CTO, and only to open a pull request);
- landing a reviewed cycle on `main` with `bin/harness/land` (one squashed commit, rebased, gates green, plain push);
- the CTO's commits of harness files (`docs/harness/*`, `docs/rpi-cycles.md`) on `main`;
- a pull request instead of a direct push, when the CTO chooses that route.

It never covers: a force push, rewriting or deleting anything on `main`, pushing to any other remote, changing repository visibility or settings, or a commit that skips the gates.

Commit messages, PR titles and descriptions never contain a Claude Code session URL or a model name, whatever the default attribution in the session's system prompt says. The trailer `Co-Authored-By: Claude <noreply@anthropic.com>` is allowed, and `bin/harness/land` adds it. Tracking files (`.rpi-tracking/`) are never committed.

## Where things are

| Path | What |
|---|---|
| `docs/scope.md` | scope |
| `docs/rpi-cycles.md` | cycles, waves, lanes, owner gates, settled decisions |
| `docs/outcomes/<nn>-<slug>.md` | what each finished cycle delivered; the handoff between cycles |
| `docs/harness/` | `CTO.md`, `TEAMMATE.md`, `STATE.md` (live board), `DECISIONS.md` (log and owner inbox), `INCIDENTS.md` (what went wrong and what changed), `README.md` |
| `bin/harness/` | `ctx` (token meter), `lane` (worktrees), `land` (one commit to `main`), `status` (snapshot), `successor` (opens the next CTO in a new iTerm2 window) |

## The application

TypeScript (ESM) on Node ≥ 22.13: one local `http` server (Vite middleware in dev) serving a canvas client. Per-module rules are in `.claude/rules/` (`shared.md`, `server.md`, `client.md`, `fixtures.md`).

### Commands

- `make install` (`npm ci`; other targets run it on demand) · `make dev` (hot reload) · `make build` · `make start` · `make stop`
- Gates: `make lint` (ESLint + `tsc` for shared, node, client) and `make test` (Vitest). `make e2e` (Playwright smoke at 1280×800 and 2×) is not a gate.
- `make fixtures` regenerates `fixtures/snapshots/sample.json`; `make replay DIR=<dir>` arrives in #3.
- **Port rule:** the port is `PORT`, else `HARNESS_PORT`, else 4477. In a lane, `.lane.env` sets `HARNESS_PORT` (8001–8004 for lanes A–D); use only your own lane's port, never 4477, and `make stop` when you are done.

### Module map

- `src/shared/` — API contract `types.ts`, `constants.ts`, pure helpers (`tools`, `verdict`, `validate`); no Node or DOM imports. #0
- `src/server/` — `cli.ts`, `start.ts`, `paths.ts`, `var.ts` (the only writer), `sample.ts`. #0
  - `config/` port and config resolution (#0, config file #3) · `api/` handler, `routes.ts` (#3 owns), static files · `discovery/` and `reader/` (#1) · `live/` and `replay/` (#3) · `harness/` (#4)
- `src/client/` — `main.ts` bootstrap. #0
  - `app/` store and snapshot loader (#0, live connection #3) · `render/` canvas and integer scale (#0, palette and sprite sheet #2) · `sprites/` and `office/` (#2, life #5) · `ui/` shell and overview (#0, inspector #6)
- `fixtures/` — `gen/` generators, `snapshots/sample.json` (#0) · `transcripts/` and `replay/` (#1)
- `test/` cross-module tests (API contract, dev server, sample, lint rules) · `e2e/` Playwright · `bin/agent-office` launcher

### Conventions

- ESM everywhere; relative imports use the `.js` specifier (`./store.js`), even from `.ts` files.
- Unit tests sit next to the code (`foo.ts` + `foo.test.ts`); cross-module tests in `test/`; browser tests in `e2e/`.
- Server code writes files only through `src/server/var.ts` (into `var/`); ESLint bans `fs` write functions elsewhere. Tests write only to the OS temp dir or `var/`.
- Add a dependency only with a one-line reason in your outcome file (`package.json` is a #0 hotspot).
- `src/shared/types.ts` is append-only: add optional fields, never rename or remove; list them in the outcome file.
- `src/client/main.ts`: one mount call per module; append yours, do not restructure.
- No real paths, session ids, prompts or config-dir content in fixtures or anywhere in the repo (it is public). Fixture ids come from `syntheticUuid()`.
