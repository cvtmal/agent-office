# Incidents

What went wrong in a harness run, why, and what changed so it does not happen again. Newest last. The CTO adds an entry for every failure of the harness itself (not of the application), in the same form, and changes `CTO.md` or `TEAMMATE.md` to match.

I-1 to I-3 come from an earlier project built with this harness. They are the reason for some rules in `CTO.md`; keep them as the first entries.

## I-1 · Handover stalled for 7½ hours

**What happened.** A CTO handed over at about 200k tokens. It pushed the handover commit, sent its last teammate a shutdown request, and ended its turn to wait for the shutdown confirmation before starting its successor. Nothing woke it. The owner noticed hours later and asked; the CTO then saw that the teammate had been inactive since the shutdown request, started the successor, and the successor was active within a minute. The lanes did no work for about 7½ hours. No work was lost: the cycle's phases were committed in its lane.

**Why.**
1. The CTO had already deleted its watchdog cron (handover step 1), so ending the turn left no wake-up at all.
2. It waited on a message (the teammate's shutdown confirmation) instead of on a state it could check. Either the confirmation never arrived or it arrived without starting a new turn.
3. `CTO.md` §5 says to `TaskStop` a teammate that has not exited within a minute. That cannot happen if the CTO is not awake a minute later.

**What changed.**
- `CTO.md` §4 step 6 and §9: never end a turn while waiting for anything, unless a wake-up is armed. That means a watchdog cron, or a background command that ends when the awaited state is reached (or after a time limit).
- `CTO.md` §9 step 1: the watchdog is deleted only after every teammate's `ctx` row is idle or ended. Shutdown is confirmed by checking `ctx` with a background wait of at most 2 minutes, then `TaskStop`. A message is not enough. The successor is then started in the same turn.

**Sign for next time.** A CTO turn that ends with "waiting for X" and no armed timer or background command is this incident about to repeat.

## I-2 · In-process teammates moved each other between lanes

**What happened.** A successor CTO, started as a `--bg` session with `teammateMode: in-process`, spawned four teammates with the Agent tool. Each called `EnterWorktree` on its own lane. Within two minutes `ctx` showed two of them working in a third teammate's lane, and the CTO's own session had been moved from lane to lane. The CTO stopped all four with `TaskStop`. Every lane was still clean, because they had only been reading. The four were restarted as background sessions inside their lanes.

**Why.** In-process teammates run inside the lead's process and share its working directory; `EnterWorktree` changes it for all of them. The preflight had verified `EnterWorktree` only for iTerm2 teammates, which are separate processes, and the in-process probe only answered PONG.

**What changed.** `CTO.md` §5: a CTO with in-process teammates starts lane teammates as background sessions inside their lanes (§10), not with the Agent tool.

**Sign for next time.** A teammate's `ctx` WHERE that is not its own lane, or an "Environment update" in the CTO's own context saying its working directory changed.

## I-3 · The successor CTO was invisible to the owner

**What happened.** A CTO started its successor with `claude --bg`, as `CTO.md` §9 then prescribed. The successor ran with no window, so the owner could not see it without `claude attach` or `claude agents`. The same choice caused I-2: a background session is not inside iTerm2, so it needed `teammateMode: in-process`, whose teammates share one working directory.

**What changed.** `bin/harness/successor <n>` opens a new iTerm2 window that runs an interactive `claude --name CTO-<n>` with the successor prompt. It carries over `CLAUDE_CONFIG_DIR` and the telemetry settings, so the same account is used under an account wrapper too. `CTO.md` §9 step 4 uses it; `claude --bg` is only the fallback (step 5). The successor runs in iTerm2 mode again, with each teammate in its own pane. The preflight (step 6, `--test`) checks the window start from an interactive session and from a `--bg` session.

**Sign for next time.** A handover that ends with the owner having to type `claude attach`.
