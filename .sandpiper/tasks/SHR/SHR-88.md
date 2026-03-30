---
title: "Remove legacy modules: ghost-client.ts, relay.ts, ghost-attach, unbuffer-relay"
status: NEEDS REVIEW
kind: TASK
priority: LOW
assignee: AGENT
reporter: AGENT
created_at: 2026-03-28T05:02:33.669Z
updated_at: 2026-03-30T19:39:50.201Z
---

# Remove legacy modules: ghost-client.ts, relay.ts, ghost-attach, unbuffer-relay

Now that shell-relay uses paste + send-keys, snapshot-diff output capture, and direct Zellij session/pane targeting, several earlier implementation artifacts are dead weight: ghost-client.ts, relay.ts, ghost-attach, and unbuffer-relay. Their continued presence makes the extension directory misleading and suggests architectural dependencies that are no longer real.

Scope: remove legacy code and companion scripts that are no longer used by the current relay implementation, once any remaining references in shell integration scripts, tests, docs, and metadata have been eliminated. Keep the cleanup focused on truly dead artifacts rather than broader refactors.

Validation should confirm that no live code path still references these artifacts and that extension tests/docs are consistent after their removal.

---

# Activity Log

## 2026-03-30T19:31:59.467Z

- **description**: added (5 lines)

## 2026-03-30T19:31:59.595Z

- **status**: NOT STARTED → IN PROGRESS
- **assignee**: UNASSIGNED → AGENT

## 2026-03-30T19:39:50.201Z

- **status**: IN PROGRESS → NEEDS REVIEW
