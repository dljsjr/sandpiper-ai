---
title: "Deduplicate remaining move/mutate reference-rewrite clone"
status: COMPLETE
resolution: DONE
kind: TASK
priority: LOW
assignee: AGENT
reporter: AGENT
created_at: 2026-04-01T06:30:48.955Z
updated_at: 2026-04-01T15:14:55.754Z
---

# Deduplicate remaining move/mutate reference-rewrite clone

After AGENT-42 clone cleanup, jscpd still reports one clone pair (packages/sandpiper-tasks-cli/src/core/move.ts lines 185-191 and core/mutate.ts lines 115-120). This is a small reference-rewrite helper pattern and can be consolidated in a follow-up cleanup pass.

---

# Activity Log

## 2026-04-01T06:30:48.985Z

- **description**: added (1 line)

## 2026-04-01T12:30:56.229Z

- **status**: NOT STARTED → IN PROGRESS
- **assignee**: UNASSIGNED → AGENT

## 2026-04-01T12:31:12.575Z

- **status**: IN PROGRESS → NEEDS REVIEW

## 2026-04-01T15:14:55.754Z

- **status**: NEEDS REVIEW → COMPLETE
- **resolution**: DONE
