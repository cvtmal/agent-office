# Agent Office

A local web app that shows your Claude Code agents as pixel-art characters working in an office: who is busy, idle or gone, what each one is doing, and how full its context is.
It runs on your machine only; today it serves a synthetic sample snapshot while the transcript reader is being built.

## Requirements

- Node.js 22.13 or newer
- `make`

## Run it

```sh
make install && make dev
```

Then open the URL it prints (`Agent Office: http://127.0.0.1:<port>/`). The port is `PORT`, else `HARNESS_PORT` (from `.lane.env` in a harness lane), else 4477.

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
| `make e2e` | install Chromium and run the Playwright smoke test (not a gate) |
| `make fixtures` | regenerate `fixtures/snapshots/sample.json` from `fixtures/gen/sample.ts` |
| `make replay DIR=<dir>` | replay a recorded set (arrives in cycle #3) |

## Command line

```sh
bin/agent-office --help
```

Options: `--port <n>`, `--dev`, `--open`, `--help`; `--config <file>` and `--replay <dir>` arrive in cycle #3.

## Privacy

Agent Office only reads Claude Code transcripts, never writes them, and listens on `127.0.0.1` only. The only files it writes are under `var/` in this checkout.
