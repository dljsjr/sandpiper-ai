---
title: "Refactor system.ts into a package (too large for a single file)"
status: COMPLETE
resolution: DONE
kind: TASK
priority: LOW
assignee: AGENT
reporter: USER
created_at: 2026-03-27T22:04:54.108Z
updated_at: 2026-04-01T04:38:21.716Z
---

# Refactor system.ts into a package (too large for a single file)

The extensions/system.ts entrypoint has grown into a large mixed-responsibility extension file that now bundles background-process tools, migration/install flag handling, startup prompt assembly, diagnostics/update banners, and background-process context notifications. Refactor it toward a package-oriented structure that preserves current behavior while making the extension entrypoint a thinner glue layer. Prefer framework-independent logic in packages/core where possible, keeping Pi-specific registration and lifecycle wiring in the extension file or in thin extension-facing modules. Avoid changing user-visible behavior, keep the new startup continuity behavior intact, and leave room for future deterministic guidance/tool-call work without letting system.ts keep growing.

---

# Activity Log

## 2026-03-30T20:48:48.999Z

- **description**: added (1 line)

## 2026-03-30T20:48:49.042Z

- **status**: NOT STARTED → IN PROGRESS
- **assignee**: UNASSIGNED → AGENT

## 2026-03-30T20:49:16.505Z

- **description**: updated

## 2026-03-30T21:00:19.830Z

- **status**: IN PROGRESS → NEEDS REVIEW

## 2026-04-01T04:38:21.719Z

- **status**: NEEDS REVIEW → COMPLETE
- **resolution**: DONE
