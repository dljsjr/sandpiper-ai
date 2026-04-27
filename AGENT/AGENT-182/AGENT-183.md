---
title: "Fix full-suite test command and stale package CLI test paths"
status: COMPLETE
resolution: DONE
kind: SUBTASK
priority: HIGH
assignee: AGENT
reporter: AGENT
created_at: 2026-05-07T18:44:38.252Z
updated_at: 2026-05-07T19:36:37.009Z
---

# Fix full-suite test command and stale package CLI test paths

Make the root test workflow invoke the intended full-suite runner and repair tests that still execute package binaries from stale root dist paths instead of package-owned build outputs.

---

# Activity Log

## 2026-05-07T18:44:41.717Z

- **status**: NOT STARTED → IN PROGRESS
- **assignee**: UNASSIGNED → AGENT
- **description**: added (1 line)

## 2026-05-07T18:48:56.734Z

- **status**: IN PROGRESS → NEEDS REVIEW

## 2026-05-07T19:36:37.010Z

- **status**: NEEDS REVIEW → COMPLETE
- **resolution**: DONE
