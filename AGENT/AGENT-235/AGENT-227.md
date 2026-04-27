---
title: "Add timeout parameter validation to shell_relay tool"
status: COMPLETE
resolution: DONE
kind: SUBTASK
priority: MEDIUM
assignee: "sandpiper-0.84-dev"
reporter: USER
created_at: 2026-07-10T15:48:36.978Z
updated_at: 2026-08-06T23:31:59.549Z
---

# Add timeout parameter validation to shell_relay tool

extensions/shell-relay/src/tools/start-relay.ts:24-28 exposes a model-facing 'timeout' parameter with no minimum/maximum bound in its TypeBox schema, and extensions/shell-relay/src/tools/operations.ts:32 computes timeoutMs = (input.timeout ?? 30) * 1000 with no validation. Non-positive or oversized values silently misbehave instead of failing clearly. Mirror Pi's own 0.80.4 fix for its bash tool (fail with a clear validation error instead of clamping to an immediate timeout).

---

# Activity Log

## 2026-08-06T20:42:26.057Z

- **parent**: AGENT-223 → AGENT-235

## 2026-08-06T23:25:23.545Z

- **status**: NOT STARTED → IN PROGRESS
- **assignee**: UNASSIGNED → sandpiper-0.84-dev

## 2026-08-06T23:31:59.491Z

- **status**: IN PROGRESS → NEEDS REVIEW

## 2026-08-06T23:31:59.549Z

- **status**: NEEDS REVIEW → COMPLETE
- **resolution**: DONE
