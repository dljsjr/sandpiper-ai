# Session Stand-Up

Updated: 2026-04-01T18:10:45Z
Session: dcd0a254-f87e-485d-9a4e-8c8fa2f5a106
Session file: /Users/doug.stephen/.sandpiper/agent/sessions/--Users-doug.stephen-git-sandpiper-ai--/2026-04-01T05-32-54-483Z_dcd0a254-f87e-485d-9a4e-8c8fa2f5a106.jsonl

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
- Finalized the remaining design decisions:
  - bootstrap is via explicit `sandpiper tasks init`
  - init always creates the local bookmark/branch and establishes remote tracking
  - `auto_push` only affects subsequent mutation pushes
  - no open questions remain in the design doc

### Task storage implementation planning
- Created and completed **TCL-85** (companion work plan).
- Added `.sandpiper/docs/task-storage-implementation-plan.md` with phased execution breakdown.
- Created the implementation task stack:
  - **TCL-86** Phase 1 — derived index + scan-first counters
  - **TCL-87** Phase 2 — current-repo separate-branch storage
  - **TCL-88** Phase 3 — external-repo storage
  - **TCL-89** Phase 4 — generalized bootstrap for future domains
- Created detailed subtasks **TCL-90** through **TCL-103** with handoff-ready descriptions mapped to the four phases.

### Self-reflection / guidance persistence
- Created and completed **AGENT-48** to persist session learnings into the repo guidance surface.
- Reviewed the relevant skills used this session:
  - **jj** — updated the advanced workspaces guidance with the newly-validated nested-workspace pattern, the `root()` unrelated-history pattern, and the colocated-repo warning to prefer `jj workspace` over `git worktree` when using jj commands in both checkouts
  - **tasks**, **code-review**, **standup**, **skill-review** — reviewed and left unchanged
- Updated **root `AGENTS.md`** routing to point future task-storage work at the new strategy + implementation-plan docs.
- Updated **`packages/sandpiper-tasks-cli/README.md`** to link the new task-storage docs as the current design references.
- No new skills were identified; the newly-learned patterns were repo-specific guidance or a jj workspace gotcha that fit cleanly into existing docs/skills.

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
