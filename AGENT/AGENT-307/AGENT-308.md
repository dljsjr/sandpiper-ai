---
title: "Bump Pi pins to 1.3.0 and fix type errors"
status: COMPLETE
resolution: DONE
kind: SUBTASK
priority: MEDIUM
assignee: UNASSIGNED
reporter: AGENT
created_at: 2026-10-16T17:17:57.184Z
updated_at: 2026-10-19T17:27:17.789Z
---

# Bump Pi pins to 1.3.0 and fix type errors

Done in jj workspace ../sandpiper-ai-pi13 (pi13). Pinned pi-ai/pi-coding-agent/pi-tui to 1.3.0 in root, packages/cli, extensions/{autotoon,shell-relay,system,web-fetch,web-search}, plugins/pi/extensions. bun install + check:deps clean. tsc produced zero errors: no Sandpiper handler reads BeforeAgentStartEvent.prompt/images, so the 1.2.0 union needed no code change.

---

# Activity Log

## 2026-10-16T17:24:46.500Z

- **description**: added (1 line)

## 2026-10-16T17:27:41.083Z

- **status**: NOT STARTED → NEEDS REVIEW

## 2026-10-19T17:27:17.792Z

- **status**: NEEDS REVIEW → COMPLETE
- **resolution**: DONE
