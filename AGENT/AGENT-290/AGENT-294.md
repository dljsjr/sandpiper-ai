---
title: "Add Pi 1.0 system prompt regression tests"
status: COMPLETE
resolution: WONTFIX
kind: SUBTASK
priority: HIGH
assignee: UNASSIGNED
reporter: AGENT
created_at: 2026-10-06T02:57:59.256Z
updated_at: 2026-11-23T22:02:35.303Z
depends_on:
  - AGENT-293
---

# Add Pi 1.0 system prompt regression tests

Turn the AGENT-290 discovery probes into Vitest tests against the real Sandpiper identity extension and an in-process recording provider (see .sandpiper/archive/agent-290-pi-1-0-migration-spec.md, System prompt invariants). Cover: user-prompted runs, idle triggered runs including a second turn, a wake before the first user prompt, a resumed session, session.state.systemPrompt as /export renders it, byte-for-byte request prefix stability, presence of the tool guidelines, and an extension-added section such as mcp_servers. Tests must fail on Pi 1.0.3 before the hybrid prompt implementation lands and must not touch real user state.

---

# Activity Log

## 2026-10-06T15:49:37.635Z

- **status**: NOT STARTED → COMPLETE
- **resolution**: WONTFIX

## 2026-11-23T22:02:35.303Z

- **description**: updated
