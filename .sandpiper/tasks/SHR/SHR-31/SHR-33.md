---
title: "Signal channel parser unit tests"
status: NEEDS REVIEW
kind: SUBTASK
priority: HIGH
assignee: AGENT
reporter: AGENT
created_at: 2026-03-20T23:00:00Z
updated_at: 2026-03-21T01:26:06-05:00
---

# Signal channel parser unit tests

Test the signal channel line parser and event emitter:

- Parse `last_status:0\n` → emit `lastStatus` with code 0
- Parse `last_status:127\n` → emit `lastStatus` with code 127
- Parse `prompt_ready\n` → emit `promptReady`
- Handle partial line reads (data arriving in chunks)
- Handle multiple messages in a single read
- Ignore malformed lines gracefully
