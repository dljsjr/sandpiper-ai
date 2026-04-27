---
title: "Investigate delayed rendering of tattler_receive batches"
status: NOT STARTED
kind: BUG
priority: HIGH
assignee: UNASSIGNED
reporter: USER
created_at: 2026-05-25T21:49:39.494Z
related:
  - TAT-36
  - TAT-38
  - TAT-59
  - TAT-62
  - TAT-65
updated_at: 2026-05-25T21:50:07.048Z

---

# Investigate delayed rendering of tattler_receive batches

Smoke test observation from Doug: tattler_receive / pending batch messages sometimes appear in the Chat Container a long time after they arrived. Determine whether this is (1) model deferring the tattler_receive tool call after a prompt cue, (2) tool/agent_end/idle scheduling delay before synthetic sendMessage(batch), or (3) Chat Container/render/replay lag after the batch is already in context. Add timestamps/instrumentation or tests around cue emit, model-visible cue, tool call, agent_end, synthetic batch sendMessage handoff, message_start/end persistence, and renderer display when feasible. Delayed rendering is a UX/observability bug because it can look like message loss even if recovery works. Duplicate task TAT-65 was closed WONTFIX in favor of this task.

---

# Activity Log

## 2026-05-25T21:50:07.048Z

- **priority**: MEDIUM → HIGH
- **description**: updated
- **related**: TAT-36, TAT-38, TAT-62 → TAT-36, TAT-38, TAT-59, TAT-62, TAT-65
