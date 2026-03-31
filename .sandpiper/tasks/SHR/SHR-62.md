---
title: "Long write-chars injections may wrap and confuse fish parser"
status: NEEDS REVIEW
kind: BUG
priority: MEDIUM
assignee: AGENT
reporter: AGENT
created_at: 2026-03-24T22:53:20.587Z
updated_at: 2026-03-31T17:15:26.362Z
---

# Long write-chars injections may wrap and confuse fish parser

When the escaped command string is long enough to wrap across terminal lines in the ghost client's pane, Zellij's write-chars may split the injection in ways that confuse fish's interactive parser. The escaped content is correct (escape tests pass), but the injection through write-chars + terminal line wrapping causes parse failures. Observed with commands containing single quotes and double quotes that produce long escaped strings. Simple commands work fine. May need to investigate: sending input via a FIFO instead of write-chars, or breaking long injections into smaller writes with delays.

---

# Activity Log

## 2026-03-24T22:53:33.607Z

- **description**: added (1 line)

## 2026-03-31T17:12:25.507Z

- **status**: NOT STARTED → IN PROGRESS
- **assignee**: UNASSIGNED → AGENT

## 2026-03-31T17:15:26.363Z

- **status**: IN PROGRESS → NEEDS REVIEW
