---
title: "Rewrite shell-relay README to match current architecture"
status: NEEDS REVIEW
kind: TASK
priority: MEDIUM
assignee: AGENT
reporter: USER
created_at: 2026-03-30T19:04:41.170Z
updated_at: 2026-03-30T19:06:54.675Z
---

# Rewrite shell-relay README to match current architecture

The shell-relay README is stale and still describes eliminated architecture such as the ghost client, expect/tclsh requirements, stdout/stderr FIFOs, unbuffer-based capture modes, and other pre-rewrite behavior. It should be brought in line with the current relay implementation: source-loaded extension, Zellij 0.44+ pane/session targeting, paste + send-keys command injection, snapshot-diff output capture, signal FIFO + shell integration requirements, and current setup/usage/limitations.

Scope: rewrite the extension README so a future contributor or agent can understand what shell-relay does today, how to set it up, what tools/commands it exposes, and where the remaining caveats are. Avoid aspirational or historical architecture except where a short note is helpful for context.

Validation should include a consistency pass against the current code, shell-relay AGENTS.md, and design docs so the README does not drift from implementation again.

---

# Activity Log

## 2026-03-30T19:04:41.215Z

- **description**: added (5 lines)

## 2026-03-30T19:04:41.259Z

- **status**: NOT STARTED → IN PROGRESS
- **assignee**: UNASSIGNED → AGENT

## 2026-03-30T19:06:54.676Z

- **status**: IN PROGRESS → NEEDS REVIEW
