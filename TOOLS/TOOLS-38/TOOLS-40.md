---
title: "Remove public Trail docs and archive internal Trail material"
status: COMPLETE
resolution: DONE
kind: SUBTASK
priority: MEDIUM
assignee: AGENT
reporter: AGENT
created_at: 2026-10-23T20:11:39.576Z
updated_at: 2026-10-28T01:17:05.008Z
---

# Remove public Trail docs and archive internal Trail material

Removed obsolete public task feature pages, package references, and the Trail-specific sprint-status prompt. Updated retained prompts to use a configured project tracker rather than a bundled tasks skill. Archived five Trail-only design/spec/audit documents plus the task feature playbook; byte comparison against the previous revision confirms all six are unchanged. Updated mixed-purpose internal specs, public build/CLI docs, indexes, and local AGENTS guidance. Local repository task policy remains and routes to installed trail. Task data/history and historical standups were not cleaned up or migrated. Verified 73 local Markdown links.

## Bookkeeping acceptance — 2026-10-27

Accepted embedded Trail removal and its documented preservation/archival evidence. Current packed-install regression confirms no bundled tasks skill or old public Trail docs. Local task tracking remains usable through the installed trail CLI. Later standup removal was independently authorized and completed under TOOLS-51.

Current verification: bun check passed with zero errors/warnings; bun run test rebuilt package output and passed 87 files / 640 tests, including packed-install, cache-restoration and temporary Trail bridge regressions. Closure requested during the return to build/packaging simplification. Original historical verification is retained above.

---

# Activity Log

## 2026-10-23T20:16:15.150Z

- **status**: NOT STARTED → IN PROGRESS
- **assignee**: UNASSIGNED → AGENT

## 2026-10-23T20:24:06.877Z

- **status**: IN PROGRESS → NEEDS REVIEW

## 2026-10-23T20:27:08.572Z

- **description**: added (1 line)

## 2026-10-28T01:17:04.945Z

- **description**: 1 line → updated (7 lines)

## 2026-10-28T01:17:05.009Z

- **status**: NEEDS REVIEW → COMPLETE
- **resolution**: DONE
