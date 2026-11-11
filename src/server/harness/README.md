# harness: reads a repo's harness files (lanes, STATE.md § Now, outcomes, last commit on `main`) into `HarnessExtras`; cycle #4.

A project is a harness project when at least one of `.claude/harness/lanes.tsv`, `docs/harness/STATE.md`, `docs/outcomes/` exists; otherwise `readHarness` gives `null` and runs no `git`. A missing or unreadable part is empty (`[]` or `null`), never an error. Read-only: file reads and one `git log` with `GIT_OPTIONAL_LOCKS=0`.

- `parseLanes(text)`, `parseStateNow(text)`, `parseOutcomeNames(names)`, `parseGitLog(stdout)` — `parse.ts`, pure.
- `laneSlugOf(where)`, `laneOf(where, harness)`, `WORKTREE_PREFIX` — `parse.ts`: a character's lane from its repo-relative `where` (`.claude/worktrees/<slug>`); used by `reader/model.ts`.
- `readHarness(dir, { git? })`, `gitLastCommit(dir)`, type `GitLog` — `read.ts`; `scanSnapshot` injects `readHarness` as `harnessOf`.
- `watchHarness(dir, onChange, { pollMs?, debounceMs?, read? })` → `{ close() }` — `watch.ts`: `fs.watch` plus an unref'd poll; `onChange` only when the reading changes (the first check is a baseline). #3 turns its callbacks into `project` events.
