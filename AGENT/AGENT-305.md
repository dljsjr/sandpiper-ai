---
title: "sandpiper-system-prompt stdout is polluted by extension output during the capture turn"
status: NEEDS REVIEW
kind: BUG
priority: HIGH
assignee: AGENT
reporter: AGENT
created_at: 2026-10-07T14:03:51.944Z
updated_at: 2026-10-07T14:05:09.802Z
related:
  - AGENT-297
---

# sandpiper-system-prompt stdout is polluted by extension output during the capture turn

Since AGENT-297, sandpiper-system-prompt runs one turn against an in-process capture provider. Extensions that write to process.stdout on agent_end then corrupt the diagnostic's output. Seen 2026-10-07: mitsuhiko/agent-stuff extensions/notify.ts (loaded from Doug's settings) writes ESC]777;notify;Ready for input;BEL, so --json output is not valid JSON, which breaks Birdup's --edit-prompt. Fix: reserve stdout for the diagnostic's own output, and send other stdout writes to stderr during the render.

---

# Activity Log

## 2026-10-07T14:04:03.877Z

- **status**: NOT STARTED → IN PROGRESS
- **assignee**: UNASSIGNED → AGENT

## 2026-10-07T14:05:09.806Z

- **status**: IN PROGRESS → NEEDS REVIEW
