---
title: "Introduce host-context path and config abstraction"
status: COMPLETE
resolution: DONE
kind: TASK
priority: HIGH
assignee: AGENT
reporter: USER
created_at: 2026-04-27T18:20:53.084Z
updated_at: 2026-04-30T20:23:17.943Z
depends_on:
  - AGENT-84
related:
  - AGENT-84
---

# Introduce host-context path and config abstraction

Introduce typed host-context/path/config abstractions so neutral capability code receives app/cwd/agent/project/session paths explicitly instead of reading Sandpiper/Pi globals.\n\nSee .sandpiper/docs/specs/package-first-multi-distribution.md.\n\nCompletion signal:\n- neutral code paths receive typed host context or specific typed path values\n- path/config tests use temp dirs only\n- direct .sandpiper/~/.sandpiper/SANDPIPER_* references are isolated to Sandpiper identity/adapters/tests

---

# Activity Log

## 2026-04-27T18:22:09.095Z

- **description**: added (1 line)

## 2026-04-30T19:02:43.887Z

- **status**: NOT STARTED → IN PROGRESS
- **assignee**: UNASSIGNED → AGENT

## 2026-04-30T19:10:42.200Z

- **status**: IN PROGRESS → NEEDS REVIEW

## 2026-04-30T20:23:17.944Z

- **status**: NEEDS REVIEW → COMPLETE
- **resolution**: DONE
