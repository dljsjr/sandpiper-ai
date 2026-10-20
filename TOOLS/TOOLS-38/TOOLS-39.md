---
title: "Remove Trail package, bundled skill, and build/test wiring"
status: COMPLETE
resolution: DONE
kind: SUBTASK
priority: MEDIUM
assignee: AGENT
reporter: AGENT
created_at: 2026-10-23T20:11:39.501Z
updated_at: 2026-10-28T01:17:04.881Z
---

# Remove Trail package, bundled skill, and build/test wiring

Removed packages/trail, the bundled tasks skill and generated CLI copies, all adoption/migration source and tests, workspace dependency and build filters, Vitest project, Knip entries, and the obsolete ast-grep exception. Removed the unused root Commander dependency after deleting the adoption CLI. Shared helper staging now copies only standup; its CLI implementation is unchanged. Retained VCS isolation through a generic devtools/test-fixtures/jj-test-config.toml. Test-first focused tests failed on the old dependencies/catalogue and passed after removal.

## Bookkeeping acceptance — 2026-10-27

Accepted embedded Trail removal and its documented preservation/archival evidence. Current packed-install regression confirms no bundled tasks skill or old public Trail docs. Local task tracking remains usable through the installed trail CLI. Later standup removal was independently authorized and completed under TOOLS-51.

Current verification: bun check passed with zero errors/warnings; bun run test rebuilt package output and passed 87 files / 640 tests, including packed-install, cache-restoration and temporary Trail bridge regressions. Closure requested during the return to build/packaging simplification. Original historical verification is retained above.

---

# Activity Log

## 2026-10-23T20:13:19.953Z

- **status**: NOT STARTED → IN PROGRESS
- **assignee**: UNASSIGNED → AGENT

## 2026-10-23T20:16:15.077Z

- **status**: IN PROGRESS → NEEDS REVIEW

## 2026-10-23T20:27:08.489Z

- **description**: added (1 line)

## 2026-10-28T01:17:04.818Z

- **description**: 1 line → updated (7 lines)

## 2026-10-28T01:17:04.881Z

- **status**: NEEDS REVIEW → COMPLETE
- **resolution**: DONE
