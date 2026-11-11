# Decisions and owner inbox

Edited only by the CTO. The owner reads this file to check in: every row in the log is a call that was made without asking and can be reversed.

## Owner inbox

Things only the owner can do or approve. The project keeps moving on the default meanwhile.

| # | What is needed | Why | Default we run on | Status |
|---|---|---|---|---|
| O-1 | Allow `gh repo create agent-office --public --source . --remote origin` (G1), or the fallback `git init --bare ../agent-office.git` + `git remote add origin` | Auto-mode classifier denied both (Create Public Surface, Remote Repoint) on 2026-11-11; without `origin`, `lane` and `land` cannot run | none possible: project halted after the bootstrap commit 4755b7f | done 2026-11-11: owner created github.com/cvtmal/agent-office and pushed |

## Log

Newest last. "Undo" says what it would take to reverse the call.

| ID | Date | By | Decision | Why | Undo |
|---|---|---|---|---|---|
| D-001 | 2026-11-11 | CTO-1 | Bootstrap commit made locally (4755b7f); halted before preflight | no `origin` could be created, and every lane is cut from `origin/main` | none needed |
