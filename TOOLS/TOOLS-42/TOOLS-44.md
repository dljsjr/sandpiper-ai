---
title: "Rename the archived skill and align its commands with PATH"
status: COMPLETE
resolution: DONE
kind: SUBTASK
priority: MEDIUM
assignee: AGENT
reporter: AGENT
created_at: 2026-10-26T14:44:09.474Z
updated_at: 2026-10-28T01:17:05.397Z
---

# Rename the archived skill and align its commands with PATH

Renamed the external archived skill folder from ~/git/skills-incubator/skills/tasks to ~/git/skills-incubator/skills/trail. Updated frontmatter name to trail and the heading. No metadata or links depended on the old skill-root directory; .sandpiper/tasks data paths remain unchanged. The legacy skill did prescribe bundled scripts/trail, so its CLI instructions and examples in SKILL.md plus two references now use trail from PATH. Archived helper binaries remain intact but are explicitly not prescribed. SDK parsing reports exactly one trail skill with no diagnostics; stale skill-name/root/bundled-command searches are clean. These edits live outside the Sandpiper jj repository.

## Bookkeeping acceptance — 2026-10-27

Accepted the temporary PATH-gated archived Trail skill bridge. Current hermetic tests cover executable probing without invoking Trail and resource discovery. This session loads the renamed external trail skill. TOOLS-43 remains NOT STARTED; no standalone discovery/release contract, download strategy, or external Trail changes were inferred or implemented.

Current verification: bun check passed with zero errors/warnings; bun run test rebuilt package output and passed 87 files / 640 tests, including packed-install, cache-restoration and temporary Trail bridge regressions. Closure requested during the return to build/packaging simplification. Original historical verification is retained above.

---

# Activity Log

## 2026-10-26T14:45:21.633Z

- **status**: NOT STARTED → IN PROGRESS
- **assignee**: UNASSIGNED → AGENT

## 2026-10-26T14:59:01.477Z

- **status**: IN PROGRESS → NEEDS REVIEW

## 2026-10-26T15:11:03.856Z

- **description**: added (1 line)

## 2026-10-28T01:17:05.334Z

- **description**: 1 line → updated (7 lines)

## 2026-10-28T01:17:05.397Z

- **status**: NEEDS REVIEW → COMPLETE
- **resolution**: DONE
