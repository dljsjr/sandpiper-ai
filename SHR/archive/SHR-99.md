---
title: "Shell Relay 2.0: revisit capture and collaboration architecture"
status: COMPLETE
resolution: WONTFIX
kind: TASK
priority: HIGH
assignee: UNASSIGNED
reporter: USER
created_at: 2026-05-14T14:45:52.929Z
updated_at: 2026-11-10T16:09:11.497Z
related:
  - SHR-98
  - SHR-97
  - SHR-71
  - SHR-90
  - SHR-68
  - SHR-69
---

# Shell Relay 2.0: revisit capture and collaboration architecture

Parking-lot initiative for a future Shell Relay 2.0 redesign.

Do not treat this as an active implementation task yet. The goal is to preserve the thread and prevent future agents from rediscovering the same capture/collaboration tradeoffs from scratch.

Scope to revisit when this is picked up:

- command-output capture architecture: snapshot-diff, marker-based screen capture, explicit shell-side capture channels, FIFOs, PTY wrappers, or another design
- collaborative semantics: user typing while the agent observes/runs commands, redraw noise, command ownership, and inspect behavior
- ANSI/PTY requirements and whether preserving terminal behavior is still mandatory
- reliable exit status, cancellation, timeouts, and bounded output
- Zellij 0.44+ capabilities, including why subscribe is not currently a primary capture channel
- shell integration surface area and whether stdout/stderr capture should return

Historical record to read first:

- .sandpiper/archive/shell-relay/shell-relay-prd.md
- .sandpiper/archive/shell-relay/lessons-learned-shell-relay-v1.md
- .sandpiper/tasks/SHR/archive/SHR-8.md
- .sandpiper/tasks/SHR/archive/SHR-70.md
- .sandpiper/archive/openclaw-process-supervisor-investigation.md
- .sandpiper/tasks/SHR/archive/SHR-79.md
- .sandpiper/archive/shell-relay/zellij-044-relay-design.md
- SHR-98

Current note:

SHR-98 tested Zellij subscribe in isolated temp sessions. It confirmed that subscribe emits rendered viewport snapshots on redraw/keypress, includes prompt decorations/prior output, and can miss high-volume output that scrolls through between renders. Treat subscribe as useful for visual monitoring/inspection, not as primary command-output capture.

---

# Activity Log

## 2026-11-10T16:09:11.499Z

- **status**: NOT STARTED → COMPLETE
- **resolution**: WONTFIX
