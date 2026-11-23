---
title: "Remove session PID files and keep the session variables process-wide"
status: COMPLETE
resolution: DONE
kind: SUBTASK
priority: MEDIUM
assignee: "session-vars"
reporter: USER
created_at: 2026-11-09T23:33:26.773Z
updated_at: 2026-11-23T22:02:37.430Z
related:
  - TOOLS-92
---

# Remove session PID files and keep the session variables process-wide

## History squashed (2026-11-10)

Doug asked for one commit per atomic unit of work. The commit ids listed under "Delivered" below are superseded. Current commits, by jj change id (stable across rewrites) with the commit id at the time of writing:

- sqmlnukm (1db07192) refactor: Stop writing session PID files, including the document changes; 84 files / 731 tests
- xkpqppnm (31a13417) fix: Clear SANDPIPER_SESSION_FILE when a session has no file; 84 / 731

Source and tests at the new tip are identical to the tree that was gated before the squash. Each commit was then gated on its own in an isolated workspace: bun check clean and bun run test passing with the counts shown.

## Delivered, awaiting review (2026-11-09)

Agent session-vars (Sonnet 5.5, high) delivered three commits from an isolated jj workspace. They sit on the main working line above b1f138d1. The main bookmark is unchanged and root dist was not rebuilt.

- 49fc8aab refactor: Stop writing session PID files (9 files, 20 insertions, 414 deletions)
- 9cf37218 fix: Clear SANDPIPER_SESSION_FILE when a session has no file (separate commit; red test first)
- 243975f9 docs: Describe session variables without PID files

Result: packages/core/src/session-continuity.ts is 13 lines and exports setSandpiperSessionEnv. paths.ts is 16 lines and keeps displayPath. SystemRuntimeState, extensions/system/runtime.ts, the runtimeState option and the session_shutdown handler are gone because only the PID code used them.

Verification by the agent and repeated by the coordinator in the agent's workspace: bun check clean; bun run test 84 files / 731 tests pass (739 - 3 in the deleted paths.test.ts - 2 in session-continuity.test.ts - 3 PID lifecycle tests in startup-hooks.test.ts).

For review:
- Commit 9cf37218 was not explicitly requested. It can be dropped without touching the PID removal.
- The docs commit also changed three statements in mailbox-coordination-architecture-notes.md from present to past tense. Revert that file if the note should stay as written.
- Four tests under devtools/ and packages/cli/ still set XDG_STATE_HOME, which now has no effect.
- 371 stale PID files remain in ~/.local/state/sandpiper/sessions (inventory row L-5). Nothing was deleted there.

## Decision

Doug decided on 2026-11-09, during the TOOLS-92 review: remove the session PID files, and keep SANDPIPER_SESSION_ID and SANDPIPER_SESSION_FILE set for the whole process. Not started. Inventory row K-10 in .sandpiper/archive/retained-surface-inventory.md.

## Why

The PID files' only reader was the removed standup helper. Nothing reads them now: not this repository, not Tattler or Chorus, not six sibling projects. 371 stale files sit in ~/.local/state/sandpiper/sessions (inventory row L-5; local cleanup, not part of this task).

Pi 0.82.0 and later give PI_SESSION_ID and PI_SESSION_FILE to bash-tool commands only. They never enter the process environment, so startup mirroring cannot produce the SANDPIPER_ names. The two assignments at session start are what make them process-wide. The global read-session-memories skill reads SANDPIPER_SESSION_FILE.

## Scope

- packages/core/src/session-continuity.ts (108 lines, 104 test lines): remove PID file writing and removal. Keep setting both variables at session start. About 10 lines remain.
- packages/core/src/paths.ts: remove getXdgStateHome, getSandpiperSessionsDirPath, getSandpiperSessionsDir and getPidFilePath. displayPath stays; its callers belong to TOOLS-93.
- extensions/system/startup-hooks.ts: adapt the session hooks.
- Update .sandpiper/docs/specs/concurrent-sessions.md and .sandpiper/playbooks/features/session-continuity.md, which describe the PID files and say to keep them.

Observed while reading: when a new session has no session file, the previous SANDPIPER_SESSION_FILE value stays set. Decide during implementation whether to clear it.

---

# Activity Log

## 2026-11-09T23:37:49.366Z

- **status**: NOT STARTED → IN PROGRESS
- **assignee**: UNASSIGNED → session-vars

## 2026-11-09T23:43:52.354Z

- **description**: 18 lines → updated (36 lines)

## 2026-11-09T23:43:52.422Z

- **status**: IN PROGRESS → NEEDS REVIEW

## 2026-11-10T15:20:25.313Z

- **description**: 36 lines → updated (45 lines)

## 2026-11-10T15:20:59.261Z

- **description**: updated

## 2026-11-10T15:48:33.322Z

- **status**: NEEDS REVIEW → COMPLETE
- **resolution**: DONE

## 2026-11-23T22:02:37.430Z

- **description**: updated
