---
title: "Bump @earendil-works/pi-coding-agent 0.79.1 -> 0.80.1 and bank inherited fixes"
status: COMPLETE
resolution: WONTFIX
kind: TASK
priority: MEDIUM
assignee: UNASSIGNED
reporter: USER
created_at: 2026-06-23T20:28:29.245Z
updated_at: 2026-08-06T20:42:40.601Z
---

# Bump @earendil-works/pi-coding-agent 0.79.1 -> 0.80.1 and bank inherited fixes

Bump both pins (root package.json:81, packages/cli/package.json:13) from 0.79.1 to 0.80.1, run build + typecheck gate, confirm nothing in the inherited surface regressed.

CONTEXT: bulk of the 0.79.1->0.80.1 delta is inherited provider/TUI fixes we get free. Feared hazard (0.80.0 moving pi-ai global API to /compat) is MOOT: grep found ZERO direct '@earendil-works/pi-ai' imports in Sandpiper source; we depend on pi-coding-agent only. This bump is the ENABLER/GATE for the Bucket-B capabilities: compaction events (0.79.10), CONFIG_DIR_NAME (0.79.7), edit diff helpers (0.79.7).

CLOSE-OUT NOTE (2026-08-06): superseded - the monorepo was bumped past 0.80.1 to 0.80.6/0.80.7 via AGENT-223/AGENT-224, which subsumed this enabler entirely. The Bucket-B capabilities it gated are all available at the current pin; their adoption is tracked by AGENT-219, AGENT-221, and the AGENT-235 tree (0.84.0 upgrade). Navigator-side edit-diff adoption is NAV-tracked in the navigator repo.

---

# Activity Log

## 2026-08-06T20:42:40.538Z

- **description**: updated

## 2026-08-06T20:42:40.602Z

- **status**: NOT STARTED → COMPLETE
- **resolution**: WONTFIX
