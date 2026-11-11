# Harness state

The CTO's memory. Edited only by the active CTO, with small edits. A successor resumes from this file alone.

## Now

- **CTO generation:** 3
- **Phase of the project:** #0–#6 landed (dee2a25, CI green); only #7 `polish` left
- **Wave in progress:** W4 (W1–W3 done 2026-11-11)

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
| #7 polish | implement | c07-impl | A (8001) | 2026-11-11 23:40 | plan has handoffs H1 (after Ph1), H2 (after Ph4); -2 resumes at Ph5 |

## Next actions

For CTO-3, in order (the loop, `CTO.md` §4):

1. **Arm the watchdog** (`CTO.md` §4 step 6) before your first wait.
2. **#7 `polish`:** `bin/harness/lane open polish`, then spawn `c07-research` (§5 template). Size M, but read its section: the owner added four lines on 2026-11-11 (D-034): detail mode as an opt-in, `docs/design/art-seam.md` (art must stay replaceable), memory 171 MB vs RUN-3's 150 MB, weak art carried from #5. Tell the researcher those lines exist. Then plan → implement → review as usual (watchers on implement and review; add "Minors never cause rework (D-027)" to the review prompt).
3. **Finish = stop for owner review** (`CTO.md` §11, D-034): after #7 lands and CI is green, make sure the README is the release report the #7 section asks for, bring `DECISIONS.md`/`STATE.md` to their final state, delete the watchdog, commit, push, then ONE push notification: the app is done; how to see it (`make start` for live, `make replay DIR=fixtures/replay/harness` for the replay); the owner's manual checks (list in Notes). Then stop.

## Notes for the successor

- `src/server/live/watch.test.ts` (#3, 500 ms timing) failed once in a #5 subagent run, green on rerun. If it fails in `land` or CI, open `fix-watch-flake` (plan → implement → review).
- **Owner rule D-027:** minors never cause rework and are not routed anywhere. Lanes `live-api` and `office-life` got the TEAMMATE.md change only at their next `lane sync`; until then add the line "Minors never cause rework (D-027, TEAMMATE.md §5)" to every review spawn prompt.
- `ctx` names the first CTO session `agent-office-91`, not `CTO-1`, so its verdict used teammate limits (RECYCLE at 180k). A successor started by `bin/harness/successor` is named `CTO-<n>`. CTO limits: `CTO.md` §2 (WARN 220k, HANDOVER 250k).
- Teammates overshoot: research/plan sessions end at 125–145k, so research→plan always gets a fresh session. L-size implement sessions stop at their plan's handoff point (~140k) and a `-2` session finishes; that worked every time.
- Spawn prompts that worked: the CTO.md §5 template plus, for implement/review, the "Save context" line and a pointer to the plan/changes log. Watcher: `until bin/harness/ctx <name> >/dev/null 2>&1; rc=$?; [ $rc -eq 20 ]; do sleep 60; done` in the background (exit 20 = RECYCLE).
- Do not `cd` into a lane in a Bash call: it moves the CTO session.
- The owner may have `docs/harness/STATE.md` open in vim (a `.STATE.md.swp` appeared); untracked, harmless.
- Owner items O-1–O-3 are all done; the inbox is empty. **Owner's manual checks for the final notification:** real sessions in the browser within 2 s; `--open` on macOS; a full speed-1 replay (12 min); frame time in a real browser; VoiceOver over hotspots and card; card on a real 2× display and a phone; #5's on-screen animations (per-kind overlays, couch, raised hand, WARN/HANDOVER meter, CTO cheer, pause).
- The owner said (not to be written into the plan): if they are not happy with the visuals at the end, the art may be redone with other tools later. That is why #7 writes the art seam doc; do not name or plan tools.
- **CI glitch (D-033):** cccf801's run stayed queued with no jobs and could neither be cancelled nor rerun; the next landing's run gave the verdict. If it happens again, do the same and log it.
- Teammates that pass 150k mid-review (c05-review stopped at 151k before `land`): a fresh `<cycle>-review-2` that only runs `land` (TEAMMATE.md §5 steps 2–4) took ~60k and worked.
- CI: since #4 landed, each push to `main` has its own concurrency group and harness-only pushes skip CI (`paths-ignore`), so harness pushes no longer cancel a landing's run.
- The owner looked at interim art (#2 Phase 5 and 9 screenshots) and asked for visuals; show them the G2 screenshots when #2 lands.

## CTO log

One line per CTO, in exactly this form, because a predecessor waits for the first three words of its successor's line:

`CTO-<n> active since <date time> · handed over <time> at <tokens> · landed <cycles>`

CTO-1 active since 2026-11-11 16:35 · handed over 2026-11-11 19:37 at ~222k · landed #0, #1, #4
CTO-2 active since 2026-11-11 19:30 · handed over 2026-11-11 22:56 at ~207k · landed #2, #3, #5, #6
CTO-3 active since 2026-11-11 22:57
