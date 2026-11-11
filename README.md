# Agent Office

A local web app that shows your Claude Code agents as pixel-art characters working in an office: who is busy, idle or gone, what each one is doing, and how full its context is.
It reads the transcripts Claude Code writes on your machine, never writes them, and serves the office on `127.0.0.1` only.

## Requirements

- Node.js 22.13 or newer
- `make` (optional: every target is a thin wrapper around `npm` and `bin/agent-office`)

Nothing else: no database, no network access at run time.

## Run it

From a clone:

```sh
make install          # npm ci
make start            # build, then serve the built app
```

Then open the URL it prints (`Agent Office: http://127.0.0.1:<port>/`). `make start` takes no options; to pass `--open`, `--sample` or any other option, start `bin/agent-office` directly (below). The port is `--port`, else `PORT`, else `HARNESS_PORT` (from `.lane.env` in a harness lane), else 4477. `make stop` stops whatever listens on that port.

After `make install` you can also start it directly, with any of the options below:

```sh
bin/agent-office --open
npx agent-office --sample     # the same script, through the package's "bin" entry
```

`npx agent-office` works inside the clone only: the package is not published to npm. `bin/agent-office` runs the built server from `dist/` when it exists, otherwise the TypeScript source through `tsx`.

To look around without any sessions of your own, start it with `--sample` (a fixed synthetic office) or replay a recorded set (below).

## Command line

| Option | What it does |
|---|---|
| `--port <n>` | port to listen on (default: `PORT`, `HARNESS_PORT`, then 4477; `0` picks a free one) |
| `--config <file>` | config file (default: `$XDG_CONFIG_HOME/agent-office/config.json`, else `~/.config/agent-office/config.json`) |
| `--sample` | serve the sample snapshot instead of the live config dir |
| `--replay <dir>` | play a replay set (e.g. `fixtures/replay/harness`) instead of the live config dir |
| `--speed <n>` | replay speed, a number greater than 0 (needs `--replay`; default 1) |
| `--detail` | detail mode (see Privacy); default: the config's `detailMode` |
| `--open` | open the office in the browser |
| `--dev` | serve the client through Vite with hot reload |
| `--help` | show this help |

## Config file

Optional. Every key may be left out; a bad key is reported on start and falls back to its default.

| Key | Default | Meaning |
|---|---|---|
| `claudeConfigDir` | `null` | where Claude Code keeps its transcripts; `null` means `CLAUDE_CONFIG_DIR`, else `~/.claude` |
| `maxAgeHours` | `24` | sessions older than this are not shown |
| `projects` | `[]` | repository roots to show; empty shows all |
| `exclude` | `[]` | globs matched against project ids and working directories |
| `detailMode` | `false` | send each tool call's raw input to the browser (see Privacy) |

`~` is expanded in paths. Example `~/.config/agent-office/config.json`:

```json
{
  "maxAgeHours": 8,
  "projects": ["~/code/my-app", "~/code/my-lib"],
  "exclude": ["~/code/scratch/*"]
}
```

## Replay

A replay set is a recorded config dir that plays back over time, for demos and tests. Two ship in `fixtures/replay/`: `harness` (a CTO with lanes) and `solo` (one session).

```sh
make replay DIR=fixtures/replay/harness SPEED=5
bin/agent-office --replay fixtures/replay/harness --speed 5
```

The replay is copied to `var/replay/` first; the set itself is never changed.

## Privacy

- **Read-only.** It never writes into the Claude Code config dir, a watched repository or git, and never starts, stops or messages a session. The only files it writes are under `var/` in this checkout.
- **Local only.** It listens on `127.0.0.1` and makes no network calls: no CDN, no telemetry, no web fonts.
- **Private by default.** The office shows tool names and short targets only: a file's basename (Read, Write, Edit, NotebookEdit, LSP, Grep, Glob), the first word of a shell command (Bash, Monitor), a URL's host (WebFetch, browser tools; a browser action's name when there is no URL), and the subagent, recipient, skill or workflow name (Agent, SendMessage, Skill, Workflow). It never shows prompt text, model output, full tool input or tool results.
- **Detail mode** (`--detail` or `"detailMode": true`, off by default) also sends each tool call's raw input, up to 2000 characters, to the browser, where the inspector shows it under "input". It prints one warning on start. It keeps the full inputs in memory, so it uses more memory than the figures below.

## Footprint

Measured on the built server with detail mode off.

| What | Limit | Measured |
|---|---|---|
| Start-up with 20 watched transcripts of 10 MB | < 2 s | 1.30–1.40 s |
| Memory (RSS) with 20 watched transcripts | < 150 MB | 119–181 MB (not met in most runs) |
| Frame time with 12 characters, 1280×800 | < 16 ms | 0.3 ms (p95) |
| Frame time with 12 characters, 2× | < 16 ms | 0.3 ms (p95) |

RSS changes a lot from run to run with the same code: 119 MB on 2026-11-11, and 151, 156, 171 and 181 MB on 2026-11-12 on a busy machine. The likely reason, not yet proven, is that V8 keeps the heap that grows while start-up reads every transcript, so RSS depends on when garbage collection happens to run. Before #7 it was 362 MB; the main cause, the last read of each file being kept in memory, is fixed.

Machine: Apple arm64 (Mac16,7), Node 26.11, 2026-11-11 and 2026-11-12. Re-measure with `make bench-mem` (start-up and RSS) and `make e2e` (the test "frame time with 12 characters" in `e2e/life.spec.ts`).

## Make targets

| Target | What it does |
|---|---|
| `make install` | `npm ci` (other targets run it on demand when the lock file changed) |
| `make dev` | dev server with hot reload (Vite inside the Node server, one port) |
| `make build` | compile the server into `dist/node/` and bundle the client into `dist/client/` |
| `make start` | build, then serve the built app |
| `make stop` | stop whatever listens on the port |
| `make lint` | ESLint, then `tsc` for shared, node and client code |
| `make test` | Vitest, all unit and contract tests |
| `make e2e` | install Chromium and run the Playwright browser tests |
| `make fixtures` | regenerate the sample snapshot, transcripts and replay sets from `fixtures/gen/` |
| `make replay DIR=<dir> [SPEED=<n>]` | play a replay set |
| `make bench-mem` | build, then measure start-up and RSS with 20 synthetic transcripts |
| `make bench-live` | measure live-tail CPU with 20 synthetic transcripts |
