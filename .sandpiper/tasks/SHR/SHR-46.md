---
title: "Replace 20ms FIFO flush delay with principled drain approach"
status: COMPLETE
resolution: DONE
kind: TASK
priority: LOW
assignee: AGENT
reporter: AGENT
created_at: 2026-03-23T04:32:18.347Z
updated_at: 2026-03-23T05:29:17.065Z
---

# Replace 20ms FIFO flush delay with principled drain approach

relay.ts uses a fixed 20ms setTimeout after receiving signals to let remaining FIFO data flush. This is a heuristic — too short for large outputs, wasted time for small outputs.

Options:
- Debounce on FIFO data arrival (wait until no data for N ms)
- Use a small drain loop that checks for pending data
- Accept the heuristic and document the trade-off

Reference: code-review-shr-v1.md Finding 3

---

# Activity Log

## 2026-03-23T04:32:18.375Z

- **description**: added (8 lines)

## 2026-03-23T05:28:44.898Z

- **status**: NOT STARTED → IN PROGRESS
- **assignee**: UNASSIGNED → AGENT

## 2026-03-23T05:29:17.065Z

- **status**: IN PROGRESS → COMPLETE
- **resolution**: DONE
