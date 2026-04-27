---
title: "Rebrand the Tasks CLI with a more memorable name"
status: COMPLETE
resolution: DONE
kind: TASK
priority: MEDIUM
assignee: AGENT
reporter: USER
created_at: 2026-03-26T21:22:51.308Z
updated_at: 2026-05-13T20:50:30.555Z
---

# Rebrand the Tasks CLI with a more memorable name

Rename the standalone plaintext task tracker product to Trail.

Scope:
- Product name: Trail.
- Primary package: @sandpiper-ai/trail.
- Primary binary: trail.
- Preserve the existing CLI command surface under the new root binary, e.g. trail task list, trail task show TCL-69, trail project list.
- Do not flatten or redesign subcommands in this task.
- The standalone Trail package should expose trail as its primary bin.
- Sandpiper distribution should provide the legacy sandpiper-tasks compatibility binary during migration.
- The bundled Sandpiper tasks skill should include both scripts/trail and scripts/sandpiper-tasks, with skill docs preferring trail and treating sandpiper-tasks as compatibility.
- Existing task project key TCL remains unchanged.

---

# Activity Log

## 2026-03-31T15:39:16.857Z

- **priority**: LOW → MEDIUM

## 2026-05-13T18:22:16.217Z

- **status**: NOT STARTED → IN PROGRESS

## 2026-05-13T18:37:45.862Z

- **description**: added (12 lines)

## 2026-05-13T19:31:49.402Z

- **assignee**: UNASSIGNED → AGENT

## 2026-05-13T19:51:58.236Z

- **status**: IN PROGRESS → NEEDS REVIEW

## 2026-05-13T20:32:46.413Z

- **status**: NEEDS REVIEW → IN PROGRESS

## 2026-05-13T20:40:08.136Z

- **status**: IN PROGRESS → NEEDS REVIEW

## 2026-05-13T20:50:30.556Z

- **status**: NEEDS REVIEW → COMPLETE
- **resolution**: DONE
