---
title: "Pi extension scaffolding and tool registration"
status: NEEDS REVIEW
kind: TASK
priority: HIGH
assignee: AGENT
reporter: AGENT
created_at: 2026-03-20T23:00:00Z
updated_at: 2026-03-21T01:47:52-05:00
---

# Pi extension scaffolding and tool registration

Create the pi extension entry point and register the `shell_relay` and `shell_relay_inspect` tools. This is the thin glue layer that connects the framework-independent core to the pi agent framework.

**Acceptance criteria:**
- Extension scaffolding: `index.ts`, `package.json`, directory structure under `extensions/shell-relay/`
- `shell_relay` tool registered with appropriate description, `promptSnippet`, `promptGuidelines`, and parameters (command, timeout)
- `shell_relay_inspect` tool registered for pane visual inspection via `dump-screen`
- Tool implementations delegate to relay orchestration and Zellij integration modules
- `index.ts` is the ONLY file that imports pi framework APIs

**References:** FR-1, FR-6
