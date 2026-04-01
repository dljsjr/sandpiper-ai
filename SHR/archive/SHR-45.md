---
title: "Make prompt_ready timeout configurable in relay orchestration"
status: COMPLETE
resolution: DONE
kind: TASK
priority: LOW
assignee: AGENT
reporter: AGENT
created_at: 2026-03-23T04:32:18.287Z
updated_at: 2026-03-23T05:27:23.529Z
---

# Make prompt_ready timeout configurable in relay orchestration

relay.ts hardcodes a 5s timeout for the prompt_ready signal after receiving last_status. If the shell has a slow prompt (e.g., complex starship config), 5s might not be enough. The timeout is non-fatal (caught and ignored), but the delay degrades UX when it triggers.

Options:
- Make it a configurable option on RelayOptions
- Reduce it since it's non-fatal anyway (e.g., 2s)
- Use an adaptive timeout based on observed prompt_ready latency

Reference: code-review-shr-v1.md Finding 2

---

# Activity Log

## 2026-03-23T04:32:18.316Z

- **description**: added (8 lines)

## 2026-03-23T05:20:35.482Z

- **status**: NOT STARTED → IN PROGRESS
- **assignee**: UNASSIGNED → AGENT

## 2026-03-23T05:27:23.529Z

- **status**: IN PROGRESS → COMPLETE
- **resolution**: DONE
