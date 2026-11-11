# Agent Office: scope

_Status: draft 2 · 2026-11-11 · Owner: Damian · Art direction: `docs/design/art-direction.md`_

## 1. What it is

Agent Office is a local web app that shows my Claude Code agents as pixel-art characters working in an office. Each live session and each subagent or teammate is a character. Characters sit at desks while they work, show what they are doing (reading, typing, running a command, searching the web), take a break when they are idle and leave when their session ends. The office has a room per project. In a project built by the agent harness (`~/code/agent-harness`), the CTO has the corner office, each lane is a desk group, and the whiteboard shows the current wave.

It runs on my machine with one command. I open `http://localhost:<port>` and leave it in a browser tab next to the terminals.

**Why:** with a CTO and four teammates working at once I can't see at a glance who is busy, who is stuck, who is about to hit the context budget and what has been done. The terminal tools (`ctx`, `status`) answer that when asked. The office shows it all the time, and makes it fun to watch.

## 2. Users and use

One user: me, on my own Mac, watching my own sessions. No accounts, no sharing, no hosting.

Typical use:
- A harness run is going. I glance at the tab: three characters typing, one at the coffee machine, the CTO's context bar is yellow.
- I click a character and see its name, role, lane, token count, verdict, and its last ten actions.
- I come back after an hour: two desks are empty (lanes closed), a new framed picture hangs on the "done" wall (a cycle landed).

## 3. Principles (apply to every requirement)

- **P-1 Read-only.** The app never writes into `~/.claude` (or `$CLAUDE_CONFIG_DIR`), into any watched repo, or into git. It never starts, stops or messages a session.
- **P-2 Local only.** The server listens on `127.0.0.1` only. No outgoing network calls at runtime: no CDN, no telemetry, no fonts from the web. All assets are in the repo.
- **P-3 Private by default.** Transcripts hold prompts, code and secrets. The UI shows tool names and short targets (a file's basename, the first word of a shell command, a URL's host). It never shows prompt text, model output, tool input in full or tool results unless I switch on "detail mode" in the config (default off).
- **P-4 Works without the harness.** Any Claude Code session on the machine shows up. Harness data (roles, lanes, waves, outcomes) adds detail when present, and nothing breaks when it isn't.
- **P-5 Tolerant of format drift.** The transcript format is internal to Claude Code and changes between versions. The parser relies on a small set of fields (§4), ignores record types it doesn't know, and never crashes on a malformed line. When too much fails to parse, the UI says so (DATA-8).
- **P-6 Original art.** All sprites, tiles and sounds are made for this project. No assets, characters or looks taken from an existing game.

## 4. Data sources

All paths are under the Claude Code config directory: `$CLAUDE_CONFIG_DIR` if set, else `~/.claude`. On my machine it is set (`~/.claudep`), so this must be honoured. `bin/harness/ctx` in the agent harness already reads all of this and is the reference implementation; read it before writing the reader.

| Source | What it gives | Notes |
|---|---|---|
| `projects/<slug>/<sessionId>.jsonl` | one session's transcript, one JSON record per line | `<slug>` is the cwd with `/` and `.` replaced by `-`. It can't be reversed reliably: take the project path from the records' `cwd` field. |
| `projects/<slug>/<sessionId>/subagents/agent-<id>.jsonl` | a subagent's or in-process teammate's transcript | |
| `projects/<slug>/<sessionId>/subagents/agent-<id>.meta.json` | `agentType`, `description`, `name`, `finished`, `stoppedByUser` | `finished: true` → idle, `stoppedByUser: true` → stopped, else busy (as in `ctx`) |
| `projects/<slug>/<sessionId>/custom-title.json` | `customTitle`, a session's name | |
| `sessions/*.json` | live registry: `pid`, `sessionId`, `procStart`, `updatedAt`, `cwd` | A session is live only if its pid is alive **and** `ps -o lstart` matches `procStart` (pid-reuse guard, see `ctx` `pid_alive`). No live entry → ended. |

Fields the parser may rely on in transcript records: `type`, `timestamp`, `sessionId`, `cwd`, `gitBranch`, `agentName`, `teamName`, `isSidechain`, `message.content[]` blocks of type `tool_use` (`name`, `input`), `tool_result`, `text`, `thinking`, and `message.usage` (`input_tokens`, `cache_creation_input_tokens`, `cache_read_input_tokens`, `output_tokens`). Everything else is optional.

Harness extras, read from each watched repo when they exist:

| Source | What it gives |
|---|---|
| `.claude/harness/lanes.tsv` | lanes: slug, letter A–D, port, worktree path |
| `.claude/worktrees/<slug>/` | which lane a session works in (match its `cwd`) |
| `docs/harness/STATE.md` § Now | CTO generation, project phase, wave in progress |
| `docs/outcomes/*.md` | finished cycles (file name = `<nn>-<slug>`) |
| `git log -1` on `main` | last landed commit |

## 5. Requirements

Each requirement has an ID that `docs/rpi-cycles.md` refers to. "Done when" is the check.

### 5.1 Data (DATA)

- **DATA-1 Discovery.** Find every session whose transcript was written in the last 24 h (setting `maxAgeHours`), plus its subagents. Group them by project (the repo root of the session's `cwd`; a worktree under `.claude/worktrees/` belongs to its parent repo). _Done when:_ with three live sessions in two repos, the API lists both projects with the right sessions.
- **DATA-2 Liveness and status.** Every character has one status: `busy`, `idle`, `waiting`, `stopped` or `ended`, worked out as in `ctx`. A session is `busy` when its last record is a user turn or a tool call that has no result yet, and `idle` when its last assistant turn has ended. `waiting` (permission prompt open) only if it can be detected reliably from the data; otherwise leave it out and record that. _Done when:_ a fixture of each case gives the expected status, and the status of a live session matches `ctx --json` for the same moment.
- **DATA-3 Activity.** Each `tool_use` becomes an activity event: `{characterId, at, tool, kind, target}`. `kind` is one of `read` (Read, Grep, Glob, LSP), `write` (Edit, Write, NotebookEdit), `shell` (Bash, Monitor), `web` (WebFetch, WebSearch, browser tools), `delegate` (Agent, SendMessage, Workflow), `plan` (TodoWrite, EnterPlanMode, Skill), `other`. `target` is short and follows P-3. _Done when:_ a unit test covers each kind and a fixture with secrets in commands and prompts doesn't leak them through the API.
- **DATA-4 Tokens and verdict.** Context size = the four usage fields of the last assistant turn added together, the same formula as `ctx`. Verdict thresholds: teammate WARN 150 000 / RECYCLE 180 000, CTO WARN 220 000 / HANDOVER 250 000. A session whose name starts with `cto` is a CTO. The same `HARNESS_*` env vars as `ctx` override them. _Done when:_ tokens and verdict agree with `ctx --json` for every row in a recorded fixture.
- **DATA-5 Live updates.** New transcript lines reach the browser within 2 s. Watch with file system events and a polling fallback (every 2 s). Read only the bytes appended since the last read, never the whole file again. _Done when:_ appending a line to a watched fixture shows up in the browser within 2 s, and CPU use stays under 5 % with 20 watched transcripts of 10 MB each.
- **DATA-6 Harness extras.** Read §4's harness files for each project. Lane letter and slug per session, CTO generation and wave, list of finished cycles. When a file is missing, that part is empty, never an error. _Done when:_ pointed at `~/code/tanzhaken` (a finished harness run), the API shows its outcomes and lanes; pointed at a non-harness repo, it shows sessions only.
- **DATA-7 Event API.** The server serves `GET /api/snapshot` (whole state as JSON) and `GET /api/events` (Server-Sent Events: `snapshot` on connect, then `character`, `activity`, `project` deltas). The JSON shapes live in one shared types module that server and client both import. _Done when:_ a contract test checks both endpoints against those types.
- **DATA-8 Format health.** Count records and lines that fail to parse per transcript. Above 5 % in the last 500 lines, the project shows a "format drift" sign in the UI with the Claude Code `version` field of the newest record. _Done when:_ a fixture with garbled lines triggers the sign and the server keeps running.
- **DATA-9 Replay.** `agent-office --replay <dir>` serves a recorded set of transcripts as if they were live, at real speed or `--speed N`. The repo ships two sanitized fixtures: a single solo session, and a harness run (CTO plus three teammates in lanes, a cycle landing). _Done when:_ replaying the harness fixture plays it through from start to finish in the browser. Teammates use replay to check the UI; tests use it too.

### 5.2 The office (OFFICE)

- **OFFICE-1 Rendering.** A pixel-art office drawn on one `<canvas>`, rendered at a low internal resolution (480×270, tiles 16×16) and scaled up in whole-number steps with no smoothing, so pixels stay sharp. 60 fps target, never below 30 with 12 characters. _Done when:_ a screenshot at 1×, 2× and 4× shows crisp pixels, and the frame time with 12 characters stays under 16 ms on my Mac.
- **OFFICE-2 Layout.** One room per project, side by side or switched by tabs (to be decided in the plan; default: tabs when more than two projects). In a room: a corner office for the CTO, four desk groups A–D for lanes, an open area with desks for sessions in the main checkout and for non-harness sessions, a kitchen (coffee machine, couch) for idle characters, a whiteboard, and a "done" wall. Desks are taken and freed as characters come and go. _Done when:_ the harness fixture puts the CTO in the corner office and each teammate at its lane's desk group.
- **OFFICE-3 Characters.** Each character has a look picked from its id, so it stays the same across reloads: at least 8 bodies × 6 palettes. Subagents look like smaller "interns" next to their parent's desk. Name tag above the head (session title, teammate name or agent type). Characters are 32×48 frames built from layered parts, as `docs/design/art-direction.md` describes. _Done when:_ 12 characters in one room are easy to tell apart, and reloading keeps each one's look.
- **OFFICE-4 Status animations.** `busy` → at the desk, with an animation per activity kind (DATA-3): reading papers, typing, a terminal glowing green, a globe on the screen, handing a folder to an intern, a sticky note on the wall. `idle` → walks to the kitchen and has a coffee, after 2 minutes sits on the couch. `waiting` (if available) → raises a hand. `stopped` → head on the desk. `ended` → walks out the door; the desk stays empty for 5 minutes, then the room tidies up. Moves are walked along a path, not teleported. _Done when:_ replaying the harness fixture shows every animation, checked against a list.
- **OFFICE-5 Context meter.** A small bar above each character: green (OK), yellow (WARN), red (RECYCLE/HANDOVER, the character sweats). _Done when:_ fixture rows at each verdict show the right colour.
- **OFFICE-6 Speech bubbles.** A new activity briefly shows a bubble with its icon and `target` (P-3: no prompt or output text), for 3 s, with at most one bubble per character. _Done when:_ a burst of 20 tool calls in 2 s gives a readable bubble, not a pile.
- **OFFICE-7 Whiteboard and done wall.** The whiteboard shows the wave in progress and the CTO generation (DATA-6). The done wall has one framed picture per outcome file, labelled `<nn> <slug>`. A cycle landing plays a short celebration (confetti, the character that landed it cheers). _Done when:_ adding an outcome file in the replay adds a picture and plays the celebration.

### 5.3 Interaction (UI)

- **UI-1 Inspect.** Clicking a character opens a side panel in the style of a character card (`docs/design/art-direction.md`): a 48×48 portrait, name, kind (session/agent), role, project, lane, status, tokens and verdict, age, cwd relative to the repo, and the last 10 activities with timestamps. Clicking elsewhere or pressing Esc closes it. _Done when:_ the panel matches the API for the clicked character.
- **UI-2 Overview strip.** A slim HTML bar above the canvas: per project the number of characters busy / idle / ended, and the highest verdict. _Done when:_ the numbers match the snapshot.
- **UI-3 Controls.** Zoom (whole-number steps), project tabs, pause animations, sound on/off (default off), and a "hide ended" toggle. Choices are remembered in `localStorage`. _Done when:_ each control works and survives a reload.
- **UI-4 Connection state.** If the event stream drops, show "reconnecting" and retry with backoff. When it reconnects, start again from the new snapshot. _Done when:_ stopping and starting the server mid-session recovers without a page reload.
- **UI-5 Accessible basics.** The side panel and overview strip are real HTML (readable by screen readers and keyboard). Animations respect `prefers-reduced-motion` (characters move without walking animation). _Done when:_ keyboard-only use reaches every control.

### 5.4 Running it (RUN)

- **RUN-1 One command.** `npx agent-office` (or `bin/agent-office` from a clone) starts the server and prints the URL. Options: `--port` (default 4477), `--config <file>`, `--replay <dir>`, `--open` (opens the browser). _Done when:_ a fresh clone runs with the documented commands and nothing else installed except Node.
- **RUN-2 Config.** Optional `~/.config/agent-office/config.json`: `claudeConfigDir`, `maxAgeHours`, `projects` (list of repo paths to include; empty = all discovered), `exclude` (path globs), `detailMode` (P-3, default false). Invalid config → a clear message and the defaults. _Done when:_ each setting has a test.
- **RUN-3 Footprint.** Under 150 MB of memory with 20 watched transcripts. Starts in under 2 s. _Done when:_ measured and written in the README.

## 6. Out of scope (v1)

- Claude Code hooks posting events to the server. Reading transcripts needs no setup and is enough for v1. A hook endpoint is the first idea for v2 (instant `waiting` detection, tool start/end timing).
- Controlling agents from the office (stop, message, spawn).
- Anything remote: other machines, cloud sessions, sharing a view, hosting.
- Costs in money. Tokens only.
- A level editor or custom office layouts. Layout is generated from the data.
- Mobile layout. Desktop browser, 1280 px and wider.

## 7. Defaults for open questions

Per harness rules, every open question has a default so no cycle waits. The CTO may settle them differently and record why.

| Question | Default |
|---|---|
| Stack | Settled: TypeScript everywhere. Node ≥ 20 server with no framework (built-in `http`, `fs.watch`). Vite for the client. Canvas 2D, no game engine, no UI framework. Vitest for tests, Playwright for browser checks. |
| How sprites are made | Sprites as code: small palette-indexed pixel grids in TypeScript files, packed into a sprite sheet when the app starts. No image files to draw by hand, diffs stay readable, and agents can make them. |
| Art direction | `docs/design/art-direction.md` (settled with the owner): a point-and-click-adventure office at dusk, warm lamps against purple night. 480×270, 16×16 tiles, characters 32×48 from layered parts, about 32 colours defined once. |
| Names when a session has no title | the first 8 characters of its id, as in `ctx` |
| Rooms with many projects | tabs when there are more than two |
| Sound | a few tiny generated sounds (Web Audio), off by default |

## 8. Owner gates

- **Art check** after the first cycle that draws characters: I look at a screenshot of the replay. Default if I don't answer within a day: go ahead.
- **Privacy check** before the API ships tool targets (DATA-3): I review the list of what is shown per tool. Default: the rules in P-3.

## 9. Suggested build order

The harness CTO plans the cycles in `docs/rpi-cycles.md`. A sensible order:

1. Bootstrap: repo, commands, gates (typecheck, lint, tests), shared types module, the two replay fixtures (DATA-9 fixtures only).
2. Data: discovery, liveness, activity, tokens (DATA-1 to DATA-4, DATA-8), checked against `ctx --json`.
3. Live and API: tailing, snapshot, SSE, replay mode (DATA-5, DATA-7, DATA-9), RUN-1, RUN-2.
4. In parallel after 3: the office renderer and sprites (OFFICE-1 to OFFICE-3); harness extras (DATA-6).
5. Behaviour: animations, meter, bubbles, whiteboard, done wall (OFFICE-4 to OFFICE-7).
6. Interaction and polish (UI-1 to UI-5, RUN-3).
