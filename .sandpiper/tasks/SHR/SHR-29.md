---
title: "Shell integration installer"
status: NEEDS REVIEW
kind: TASK
priority: MEDIUM
assignee: AGENT
reporter: AGENT
created_at: 2026-03-20T23:00:00Z
updated_at: 2026-03-21T01:47:52-05:00
---

# Shell integration installer

On extension installation or first use, guide the user through shell integration setup.

**Acceptance criteria:**
- Detect user's shell via `$SHELL`
- Install integration scripts + `unbuffer-relay` to extension data directory
- Emit clear instructions for sourcing the appropriate script in the user's shell RC file
- Leverage pi's extension installation lifecycle hooks where available

**References:** FR-14 (installation section)
