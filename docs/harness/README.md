# Agent harness

A base for building a whole project with Claude Code while you are away from the keyboard. One session, the CTO, works from a written plan (`docs/rpi-cycles.md`). It spawns teammates, gives each one phase of one cycle in its own git worktree, measures their context size, shuts them down and replaces them, lands finished cycles on `main`, and hands over to a successor CTO when its own context is full. You start it once and read `DECISIONS.md` when you want to check in.

## Requirements

- Claude Code with agent teams available (`CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS=1`, set for the repository in `.claude/settings.json`), in a permission mode that does not prompt for routine work.
- git and python3. `gh` if the remote is on GitHub.
- For unattended handovers: macOS with iTerm2, and the Automation permission for the terminal Claude Code runs in (`bin/harness/successor` opens the next CTO in a new iTerm2 window). Elsewhere the CTO falls back to a background session (`CTO.md` §9 step 5), or adapt the script to your terminal.
- Four phase commands for the RPI workflow (Research, Plan, Implement, Review), as skills named `rpi:rpi-research`, `rpi:rpi-plan`, `rpi:rpi-implement` and `rpi:rpi-review`. The harness relies on this contract:
  - each command takes the cycle's slug as its argument;
  - artifacts are written to `.rpi-tracking/{research,plans,changes,reviews}/<date>/<slug>-<phase>.md`;
  - the review artifact has a section `## Overall Status` whose line carries `✅ Complete`, `⚠️ Needs Rework` or `🚫 Blocked` (`bin/harness/land` refuses to land without `Complete` there);
  - each phase starts from a clean context and reads the previous phase's artifact.

## Files

| File | Purpose |
|---|---|
| `CLAUDE.md` (repo root) | roles, the rules every harness session follows, the standing git authorisation |
| `docs/rpi-cycles.md` | the plan: cycles, waves and lanes, owner gates, settled decisions (a template here) |
| `docs/harness/CTO.md` | the CTO's playbook: ownership, budgets, the loop, handover |
| `docs/harness/TEAMMATE.md` | what a teammate does in its one phase, and its report format |
| `docs/harness/STATE.md` | the CTO's live memory; a successor resumes from it |
| `docs/harness/DECISIONS.md` | every call made without you, and the inbox of things only you can do |
| `docs/harness/INCIDENTS.md` | harness failures, their causes and the rules they produced |
| `docs/harness/successor-prompt.txt` | the starter prompt one CTO gives the next |
| `.claude/skills/cto/SKILL.md` | the `/cto` command |
| `.claude/settings.json` | agent teams on, teammate panes, allowed and denied commands |
| `bin/harness/ctx` | token count of every session of this project |
| `bin/harness/lane` | open, list, sync, close worktree lanes |
| `bin/harness/land` | land a reviewed cycle as one commit on `main` |
| `bin/harness/status` | one-screen snapshot |
| `bin/harness/successor` | open the next CTO in a new iTerm2 window |

Each tool explains itself with `--help`.

## Set up a new project

1. Copy everything in this repository into the new project.
2. Fill in `CLAUDE.md`: the project's name, what it is, where the scope document is.
3. Write the scope document (a PRD or equivalent).
4. Write `docs/rpi-cycles.md` from the template. This is the real work: the CTO is only as good as its plan. Two things save the most trouble in parallel lanes: let the first cycle add every shared dependency, so lanes rarely meet in the lock file; and prefer one file per module over one shared file, or give each shared file a hotspot row (append-only, own rows only).
5. Adjust to the stack:
   - `.claude/settings.json`: add allow rules for the project's own tools (package manager, test runner, console). Set `teammateMode` to what your terminal supports (`iterm2`, `tmux`, `in-process` or `auto`).
   - The gates `land` runs before pushing default to `make lint` and `make test`. Either give the project those targets or set `HARNESS_GATES` (one command per line).
   - The lane ports (8001–8004) are assigned by `bin/harness/lane`; change them there if they clash.
6. Have a fresh session review what you set up (plan, `CLAUDE.md`, settings) against this README and the playbooks, and treat every contradiction it finds as a setup error. The session that writes the plan is usually far past a useful context size by the end.
7. Do "Before the first start" below.

## Before the first start

1. **Auto mode and this repository.** If you run in auto mode, its classifier decides whether a push is allowed, and it trusts only what your *user* settings describe as trusted. Project settings cannot change that. If your user settings name specific trusted repositories, add this one, for example a line like this in `autoMode.environment` of your user `settings.json`:

   `"**Personal projects**: git repositories under <your projects folder> and their own origin remotes are trusted; committing and pushing to main there is routine."`

2. **The git rule.** `CLAUDE.md` § Git is where you grant the CTO and its teammates the right to commit and push without asking. It deliberately overrides a personal "ask before committing" rule, for harness sessions only. Read it before you adopt it and narrow it if it goes further than you want.
3. **Your global git rule.** Teammates and background successors never get a turn from you, and they and the auto-mode classifier read your global `CLAUDE.md` too. If it says "never commit or push unless I ask", add one exception line under it, for example: "Exception: in ~/<path of this project> the repository's own CLAUDE.md § Git is my standing instruction for harness sessions." Check that the line is there before the start; no harness session may add it.
4. **Background sessions.** Auto mode may deny the CTO `claude stop` and `claude rm` on background sessions even though the project settings allow them. Allow them in your user settings if you want finished background teammates cleaned up without you.
5. **Commit identity and GitHub account.** Set `git config user.email` in the repository before the start; `main` is never rewritten, so the address stays on every commit. Keep `gh`'s active account on the one that owns the repository for the whole run: `gh auth switch` is global, and switching in another terminal hides the CI result from the CTO.
6. **A public repository** (for example for free CI minutes) makes every committed file, commit message and pull request readable by anyone. Keep names of your other work out of it (a git-ignored file under `.claude/harness/` is the place for local notes), and use invented values of the same shape for personal data in examples and fixtures. Removing something from history needs a force push, which the harness never does.
7. **Anything the plan's owner gates need from you** (logins, accounts, access): do it now, or accept that the CTO runs on the gate's default.

## Start

```
cd <project>
claude --name CTO "/cto You may commit and push to main in this repository without asking, for the whole run, and so may the teammates you spawn."
```

The first CTO makes the first commit (on top of any existing one), pushes it to `origin` or sets up a remote if there is none, checks the mechanics with a throwaway teammate, and starts wave 0.

## Watch

- `bin/harness/status`: `main`, finished cycles, lanes, sessions with token counts, CI.
- `bin/harness/ctx`: only the sessions and their token counts.
- `docs/harness/STATE.md`: what is in flight and what comes next.
- `docs/harness/DECISIONS.md`: what was decided, and what waits for you.
- `claude agents` lists background sessions; `claude attach <name>` opens one. You need it only when the CTO runs on a fallback; normally every CTO and teammate has its own iTerm2 window or pane.

## Steer or stop

Type into the CTO session; it treats what you say as an instruction on top of the playbook. To stop cleanly, tell it to "finish the running phases, update STATE.md and stop". To change the plan, edit `docs/rpi-cycles.md` while no CTO is running, or tell the CTO what to change.

## Handover between CTO sessions

At about 250k tokens the CTO shuts its teammates down at a phase boundary, updates `STATE.md`, commits and pushes it, and opens its successor in a new iTerm2 window (`bin/harness/successor`), running an interactive session with the text of `docs/harness/successor-prompt.txt`. The new window is how you see that a handover happened. If the window cannot be opened, the CTO starts the successor as a background session instead; if that fails too, you get a notification with the command to run:

```
claude --name "CTO-2" "/cto"
```

The starter prompt never changes, for the first CTO and every later one, because everything that changes is in `STATE.md`. `/cto` is your short form of it; the skill is marked so that only a person can invoke it, which is why a CTO starts its successor with the prompt file instead.

## Design decisions built in

- **One teammate session per phase.** RPI needs a clean context between phases and a teammate cannot clear itself, so a phase boundary is a session boundary. It also keeps every session far below 200k tokens.
- **Worktrees under `.claude/worktrees/<slug>`.** It is the one place a spawned agent can enter with EnterWorktree without a prompt, and file access stays inside the project.
- **Trunk-based landing.** One squashed commit per cycle, rebased and gated in the lane, pushed straight to `main`. A pull request is the CTO's option when CI should gate first.
- **Outcome files.** Each finished cycle writes `docs/outcomes/<nn>-<slug>.md`. Later cycles read those, not the code and not the whole plan.
- **Default agent type for teammates.** In split-pane mode the body of a custom agent definition replaces the system prompt, so the harness uses none.
- **State on disk.** The CTO's memory is `STATE.md`, so a successor needs no conversation history.
- **Never wait without a wake-up.** A CTO ends a turn only with a watchdog cron or a background command armed; an expected message is not a wake-up (`INCIDENTS.md` I-1).
- **Successor in its own window.** A visible iTerm2 session, not a background one, so you can see it and its teammates stay separate processes with their own working directory (`INCIDENTS.md` I-2, I-3).

## What is not proven

The harness rests on documented Claude Code behaviour that the first CTO checks in its preflight and records in `STATE.md` § Mechanics:

- how a teammate shows up in `bin/harness/ctx` in pane mode and in in-process mode;
- that teammates can run the `rpi:*` skills and have the browser tools;
- that `bin/harness/successor` can open a window, from an interactive and from a background session;
- that a CTO started in the background can spawn teammates itself;
- that the permission mode lets the first push and the successor start through.

`bin/harness/ctx` reads Claude Code's transcript files, whose format is not a public interface. If a Claude Code update changes it, `ctx` is the tool to fix.
