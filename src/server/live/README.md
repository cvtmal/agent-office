# live: tails and watches transcripts and pushes deltas to the model; cycle #3.

Data flow: `watch.ts` (fs.watch + 2 s poll) → changed paths → `model.ts` `ingest` → `tail.ts` reads only appended bytes → `reader/retain.ts` keeps the bounded records → `buildModel` over them → `diff.ts` → `ServerEvent[]` → `source.ts` listeners (SSE).

- `tail.ts` — `createTail(path)`: byte offset + carry per file; reset on truncate/replace.
- `watch.ts` — `watchTree({ dirs, pollMs, batchMs, poll, onBatch })`: batches of changed paths (≤ every 100 ms, R4).
- `model.ts` — `createLiveModel(opts)`: per-file tail + retained records, admission (age window, live, quiet teammates R7), aging on `refreshLiveness`, `rebuild()` → diff → `onEvents`.
- `diff.ts` — `diffSnapshots(prev, next)`, pure: `project`, `character`, `activity` deltas; a removal → one `snapshot` (R3).
- `harness.ts` — `createHarnessCache({ dirOf, read, watch, onChange })`: `harnessOf(root)` read once, then watched (D-016).
- `source.ts` — `LiveSource` (`getSnapshot`, `subscribe`, `close`); `staticSource(snapshot)` for `--sample`/tests; `createLiveSource({ env, home, config })` wires config dir, thresholds, registry + async `ps` (on `sessions/` change or every 10 s, R6), harness cache and watcher.
- Read-only: transcripts and the config dir are never written; tests copy fixtures into the OS temp dir.
