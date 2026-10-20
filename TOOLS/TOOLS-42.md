---
title: "Temporarily load the archived Trail skill when trail is on PATH"
status: COMPLETE
resolution: DONE
kind: TASK
priority: MEDIUM
assignee: AGENT
reporter: USER
created_at: 2026-10-26T14:43:53.558Z
updated_at: 2026-10-28T01:17:05.773Z
related:
  - TOOLS-38
---

# Temporarily load the archived Trail skill when trail is on PATH

Rename ~/git/skills-incubator/skills/tasks to trail and change its skill name to trail. Verify no skill-root path dependencies need migration; change bundled CLI instructions/examples to use trail from PATH so the temporary integration really uses the selected external tool. In Sandpiper resource discovery, add the hard-coded archived skill directory only when an executable named trail is available on PATH. No new flags, downloads, release management, or Trail skill discovery commands. Keep built-in skills available when trail is absent. Add hermetic tests and rebuild so the harness can reload while standalone Trail is in flight. Do not contact the Trail agent.

## Bookkeeping acceptance — 2026-10-27

Accepted the temporary PATH-gated archived Trail skill bridge. Current hermetic tests cover executable probing without invoking Trail and resource discovery. This session loads the renamed external trail skill. TOOLS-43 remains NOT STARTED; no standalone discovery/release contract, download strategy, or external Trail changes were inferred or implemented.

Current verification: bun check passed with zero errors/warnings; bun run test rebuilt package output and passed 87 files / 640 tests, including packed-install, cache-restoration and temporary Trail bridge regressions. Closure requested during the return to build/packaging simplification. Original historical verification is retained above.

---

# Activity Log

## 2026-10-26T14:44:09.252Z

- **status**: NOT STARTED → IN PROGRESS
- **assignee**: UNASSIGNED → AGENT

## 2026-10-26T15:11:04.158Z

- **status**: IN PROGRESS → NEEDS REVIEW

## 2026-10-28T01:17:05.711Z

- **description**: 1 line → updated (7 lines)

## 2026-10-28T01:17:05.774Z

- **status**: NEEDS REVIEW → COMPLETE
- **resolution**: DONE
