---
title: "Split Tattler package family and thin Pi binding"
status: NOT STARTED
kind: TASK
priority: MEDIUM
assignee: UNASSIGNED
reporter: USER
created_at: 2026-05-15T03:13:38.440Z
depends_on:
  - TAT-6
updated_at: 2026-05-15T03:13:47.658Z
---

# Split Tattler package family and thin Pi binding

Move from spike implementation to the package structure accepted for the first MVP.

Scope:
- @sandpiper-ai/tattler-core for same-host identity, runtime claims, sockets, directory, discovery, and protocol dispatch.
- @sandpiper-ai/tattler-agent-message for tattler.agent-message.v1 and compact notification rendering helper.
- @sandpiper-ai/tattler as product/metapackage entrypoint.
- Thin Pi/Sandpiper binding that persists session identity, registers agent-message, exposes tools/commands, and delivers via system notifications.

Depends on: TAT-6 / v1 mini-spec.

---

# Activity Log

## 2026-05-15T03:13:47.659Z

- **depends_on**: (none) → TAT-6
