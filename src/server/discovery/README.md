# discovery: finds transcripts, subagents and live sessions in the config dir (read-only); cycle #1.

All file and process access of the reader. Read-only: it never writes, and it never interprets records.

- `discover({ cfgDir, now, maxAgeHours, table })` → `Discovered` (`index.ts`): one scan; the only IO result the reader sees.
- `configDir(env, home)` — `CLAUDE_CONFIG_DIR`, else `~/.claude`.
- `readProcessTable()` / `parsePsOutput(text)` / `parseLstart(s)` — one `ps -axo pid=,lstart=,command=` per scan (P4); null when `ps` fails.
- `liveRegistry(cfgDir, table, probe?)` / `pidAlive(...)` — `sessions/<pid>.json` entries whose pid is alive and not reused, by session id.
- `teammateProcs(table)` — `--agent-name`/`--team-name` pairs of running teammate processes (D3).
- `readTranscripts({ cfgDir, cutoffMs, isLive })` — session and subagent transcripts (+ meta, `custom-title.json`) newer than the cutoff or live.
- `repoRoot(cwd)` (worktree → main checkout), `whereIn(root, cwd)`, `displayPath(path, home)`.
