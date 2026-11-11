# Harness state

The CTO's memory. Edited only by the active CTO, with small edits. A successor resumes from this file alone.

## Now

- **CTO generation:** 1
- **Phase of the project:** W0 running
- **Wave in progress:** W0

## Mechanics

How the harness expects Claude Code to behave. The first CTO confirms the lines marked "Verify" in its preflight (`CTO.md` §3) and corrects this section to match what it finds.

- Agent teams are switched on for this repository in `.claude/settings.json` (`CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS=1`). A teammate is spawned by an Agent call that has a `name` and no `isolation`. Teammates load `CLAUDE.md`, skills and MCP servers but not the lead's conversation. They start in the lead's permission mode. No nested teams; the lead cannot change; in-process teammates do not survive a resume of the lead.
- The model's context window is much larger than the budgets in `CTO.md` §2, and nothing compacts or stops a session at those budgets. They are enforced only by us.
- Verify: how a teammate appears in `bin/harness/ctx` (its own session row in split-pane mode, an agent row in in-process mode). In an earlier run, `ctx` STATUS showed live split-pane teammates as `ended`; judge liveness by AGE.
- `bin/harness/ctx --self` identifies the session by `CLAUDE_CODE_SESSION_ID`. Inside an in-process teammate or a subagent that is the parent's id, so `--self` prints the parent's row; such a teammate finds its own row with `bin/harness/ctx <its name>`.
- Verify: teammates can run the `rpi:*` skills through the Skill tool, and whether they have the browser tools.
- Verify: `bin/harness/successor --test` opens a window from this session and from a `claude --bg` session (preflight step 6), and `CronCreate` one-off jobs fire while the CTO is idle (step 7).
- A `claude --bg` session is not inside iTerm2: with `teammateMode: iterm2` it cannot spawn teammates, so it is started with `--settings '{"teammateMode":"in-process"}'`. In-process teammates share the lead's working directory (`INCIDENTS.md` I-2), so such a CTO starts lane teammates as background sessions (`CTO.md` §5, §10).
- Background sessions cannot edit files in the shared main checkout; a `--bg` CTO edits harness files in a private worktree (`CTO.md` §4, "Pushing harness files").
- A `cd` in a Bash call moves the session's own working directory; start processes in a lane from a subshell, `( cd <lane> && … )`.
- Worktrees under `.claude/worktrees/` can be entered with EnterWorktree and a `path` without a prompt.
- `bin/harness/land` pushes to `origin` and does not move the local `main` of the main checkout; the CTO runs `git pull --ff-only` there after each landing.
- `bin/harness/lane open` writes ignore rules into `.git/info/exclude`, so lane files never show up as changes. `HARNESS_GATES` for `land` takes one command per line.
- Fresh-session baseline: not measured yet (about 50k in an earlier run, with skills and MCP servers loaded). Measure it: run `bin/harness/ctx --self` at the very start of a fresh session and write the number here. A teammate's working room is 150k minus that.

- **Preflight 2026-11-11 (CTO-1):** teammate `probe` spawned via Agent with `name` (agent teams work). It appears in `ctx` as its own `session` row (WHERE = its worktree), STATUS `ended` while live (judge by AGE); ~57k at its first report, plausible. EnterWorktree with `path` worked; `rpi:*` skills listed; `claude-in-chrome` tools available (deferred, load via ToolSearch). `successor --test` writes `ok` from this session and from a `claude --bg` session (the target directory must exist: `mkdir -p .rpi-tracking` first). `claude stop`/`claude rm` on a bg session worked. Pushes from the CTO session to `origin` work; `gh repo create` was denied by auto mode (owner did it).
- **Cron:** a recurring `CronCreate` job fires while the CTO is idle (watchdog fired 16:54). A one-shot set for a minute that had already passed by the time the CTO went idle never fired; set one-shots several minutes ahead.
- **Fresh-session baseline:** ~50k (bg session 50.5k after one command; probe 57k after five).

## Board

Status of every cycle is the last column of the overview in `docs/rpi-cycles.md`. This table holds only what is in flight.

| Cycle | Phase | Teammate | Lane | Since | Note |
|---|---|---|---|---|---|
| #0 bootstrap | review | c00-review | A (8001) | 2026-11-11 17:27 | impl done (119 tests, e2e green); lands trunk, check first CI run |

## Next actions

Bootstrap steps 0–4 done (2026-11-11). Now: the loop, CTO.md §4; #0 is in research.

Bootstrap, in order (generation 0 → 1):

0. Set **CTO generation** under § Now to 1 and add your line to § CTO log, before anything else.
1. `git status`: commit everything present on `main` (`chore: project plan and agent harness`), on top of the repository's existing commits if it has any.
2. If `origin` exists, push with `git push origin HEAD:main` (create no repository, add no remote). If no `origin` exists, resolve the repository gate in `docs/rpi-cycles.md` § Owner gates. If creating the remote is refused or fails, create a local bare repository beside the project, add it as `origin`, push, and put the gate in the Owner inbox.
3. Preflight as in `CTO.md` §3. Record the results under § Mechanics.
4. Check whatever the owner gates need from outside the repository (logins, accounts, access). For each one that is missing, add an Owner inbox row, send one push notification if the owner has to act, and continue on the gate's default.
5. Open the lanes for the cycles of wave 0 and start their first phases.
6. From here on: the loop in `CTO.md` §4.

## Notes for the successor

- 2026-11-11: bootstrap step 1 done (commit 4755b7f, local only). Step 2 blocked: auto mode denied both `gh repo create` and adding a local bare `origin` (DECISIONS O-1). Resolved: owner created the GitHub repo and pushed main. Pushes from sessions may still be denied by auto mode; if so, record it and tell the owner.

- For #1's spawn prompt: `ctx` can emit status `live`, which is not in the S3 enum; #1 must map it (from c00-research).

## CTO log

One line per CTO, in exactly this form, because a predecessor waits for the first three words of its successor's line:

`CTO-<n> active since <date time> · handed over <time> at <tokens> · landed <cycles>`

CTO-1 active since 2026-11-11 16:35 · handed over — · landed —
