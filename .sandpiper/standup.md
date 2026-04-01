# Session Stand-Up

Updated: 2026-04-01T17:48:00Z
Session: current

## Accomplished

### Refactor plan review, ticket closure, and history curation
- Code review passed (revision 2 verdict: **Approve**).
- Addressed all rev 1 review findings (type-safe test stubs, dynamic import, readonly, JSDoc, naming).
- Closed all 13 approved refactor-plan tickets (AGENT-39–45, SHR-96, TCL-72–75, TCL-77).
- Curated history to 2 logical commits; advanced `main` bookmark.

### Documentation sweep — ticket all future work
- Scanned all design docs, PRDs, and code review findings for documented-but-unticketted future work.
- Created 11 new backlog tickets covering: WEB deferred features (WEB-9 through WEB-13), ProcessManager open questions (AGENT-46, AGENT-47), and TCL code review follow-ups (TCL-78 through TCL-81).

### Backlog triage pass
- Reviewed all 38 NOT STARTED tickets with user; reprioritized 12:
  - Bumped LOW → MEDIUM: AGENT-14, AGENT-16, AGENT-28, SHR-67, TCL-57/58/59, TCL-80, TOOLS-7, WEB-10, WEB-11
  - Bumped MEDIUM → HIGH: WEB-9

### Task storage strategy design + jj spike
- Created and completed **TCL-82** (design doc), **TCL-83** (jj/git mechanics spike), and **TCL-84** (root-based jj remote sync spike).
- Added `.sandpiper/docs/task-storage-strategy.md` describing a configurable task storage model:
  - inline mode (`branch: "@"`)
  - separate-branch mode in the current repo
  - external repo mode via plain clone
  - opt-in `auto_commit` and `auto_push`
  - standalone root config file (`.sandpiper-tasks.json`) overriding `.sandpiper/settings.json`
  - `index.toon` treated as derived state
- Spike findings:
  - **jj repo → use `jj workspace`** at `.sandpiper/tasks/`
  - **plain git repo → use `git worktree`**
  - **do not use `git worktree` inside a jj repo**
  - **external repos are plain clones**, not workspaces/worktrees; use `jj git clone --colocate` in jj projects and `git clone` in git projects
  - **root()-based jj task history pushes/pulls cleanly** via a bookmark-backed branch on the real project remote
  - **remote recovery works**: after deleting the local workspace/bookmark, `jj git fetch` restores the remote-tracking bookmark and a fresh workspace can be recreated from `<bookmark>@origin`
- Remaining open questions in the design doc are now narrowed to bootstrap UX and how much remote bookmark setup should be automatic on first bootstrap.

## Deferred decisions (need dedicated session)
- **SHR-68/69** (bash/zsh user command capture) — need a discussion before final triage
- **MEM-1** — user has a detailed design doc; triage after a dedicated MEM design review session
- **TCL-55/61** (index spike alternatives) — may be subsumed by MEM design, re-triage after MEM review

## In Progress
- None.

## Next Session
Good candidates to pick up next:
- **TCL-71** (HIGH) — require key or explicit filter on mutating commands; safety improvement, ready to implement
- **WEB-9** (HIGH) — CSS selector targeting; easy win, API already designed
- **Task storage Phase 1** — gitignore `index.toon`, rebuild it as derived state, and make scan-from-disk the primary counter allocation path
- **AGENT-35** (HIGH) — deterministic enforcement hooks; significant design effort, worth planning

## Blockers
- None.

## Context
- `main` is ahead of `main@origin` by several commits (ticket creation, triage pass, task storage design/spike). User is handling pushes manually.
- SHR-68/69 discussion deferred; they remain at MEDIUM pending that conversation.
- TCL-55/61 remain LOW pending MEM design review.
- The task storage design now explicitly distinguishes current-repo separate-branch storage from external-repo clone storage; do not reuse `git worktree` inside jj repos.
