---
title: "Run clone cleanup sweep across remaining low-priority duplicates"
status: COMPLETE
resolution: DONE
kind: TASK
priority: LOW
assignee: AGENT
reporter: USER
created_at: 2026-04-01T06:05:07.054Z
updated_at: 2026-04-01T15:14:55.435Z
---

# Run clone cleanup sweep across remaining low-priority duplicates

Address remaining low-priority clone pairs identified by jscpd in non-generated source code and rerun duplication report with scoped ignores (exclude dist/, skills/, tests, generated).

Candidate files:
- packages/sandpiper-tasks-cli/src/core/archive.ts
- packages/sandpiper-tasks-cli/src/commands/project-cmd.ts
- extensions/system/migrate-pi-configs.ts
- draw-sandpiper.ts

---

# Activity Log

## 2026-04-01T06:05:26.731Z

- **description**: added (7 lines)

## 2026-04-01T06:27:16.462Z

- **status**: NOT STARTED → IN PROGRESS
- **assignee**: UNASSIGNED → AGENT

## 2026-04-01T06:30:53.434Z

- **status**: IN PROGRESS → NEEDS REVIEW

## 2026-04-01T15:14:55.435Z

- **status**: NEEDS REVIEW → COMPLETE
- **resolution**: DONE
