---
title: "Parameterize filesystem targets without nested overrides and audit tests for production-path access"
status: COMPLETE
resolution: DONE
kind: TASK
priority: HIGH
assignee: AGENT
reporter: USER
created_at: 2026-03-30T18:34:48.194Z
updated_at: 2026-03-30T18:42:42.132Z
---

# Parameterize filesystem targets without nested overrides and audit tests for production-path access

Refine the recent filesystem testability work so overrides target the actual resource being exercised rather than introducing generic homedir overrides. Follow the existing parameterization routes where they already exist (for example, PI_CODING_AGENT_DIR / SANDPIPER_CODING_AGENT_DIR for ~/.sandpiper/agent), avoid nested child overrides when the parent is already parameterized, and clean up any SCREAMING_SNAKE_CASE names that no longer represent true constants. While doing this, audit the repo for any remaining tests or non-production code paths that read/write real on-disk production locations and fix them.

---

# Activity Log

## 2026-03-30T18:34:55.874Z

- **description**: added (1 line)

## 2026-03-30T18:34:55.917Z

- **status**: NOT STARTED → IN PROGRESS
- **assignee**: UNASSIGNED → AGENT

## 2026-03-30T18:42:42.133Z

- **status**: IN PROGRESS → COMPLETE
- **resolution**: DONE
