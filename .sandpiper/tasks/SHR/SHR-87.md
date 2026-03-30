---
title: "Simplify shell integration scripts: remove stdout/stderr/unbuffer FIFO requirements"
status: NEEDS REVIEW
kind: TASK
priority: MEDIUM
assignee: AGENT
reporter: AGENT
created_at: 2026-03-28T05:02:33.626Z
updated_at: 2026-03-30T19:39:50.159Z
---

# Simplify shell integration scripts: remove stdout/stderr/unbuffer FIFO requirements

The current shell integration scripts still carry compatibility-shim logic for stdout/stderr FIFOs and the old unbuffer-based capture path, even though the live relay now captures output via snapshot diff and only relies on the signal FIFO for prompt_ready and exit status. That leftover logic makes the scripts harder to understand, keeps stale env-var expectations alive, and blocks cleanup of old artifacts.

Scope: simplify relay.fish, relay.bash, and relay.zsh so they match the current architecture. Remove assumptions that the extension must provide stdout/stderr FIFOs or an unbuffer wrapper path, while preserving current prompt_ready and last_status behavior. Update tests accordingly.

Validation should show that the relay still initializes, reports prompt readiness, executes commands correctly, and no longer requires compatibility-shim env vars.

---

# Activity Log

## 2026-03-30T19:31:59.416Z

- **description**: added (5 lines)

## 2026-03-30T19:31:59.553Z

- **status**: NOT STARTED → IN PROGRESS
- **assignee**: UNASSIGNED → AGENT

## 2026-03-30T19:39:50.159Z

- **status**: IN PROGRESS → NEEDS REVIEW
