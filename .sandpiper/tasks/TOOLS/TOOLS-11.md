---
title: "Clean up stale built-extension assumptions after TOOLS-10"
status: NEEDS REVIEW
kind: TASK
priority: MEDIUM
assignee: AGENT
reporter: USER
created_at: 2026-03-30T18:57:04.051Z
updated_at: 2026-03-30T19:02:25.243Z
---

# Clean up stale built-extension assumptions after TOOLS-10

TOOLS-10 switched shell-relay and web-fetch from bundled/compiled extension entrypoints to Pi's normal jiti-loaded source model (./src/index.ts). Follow-up cleanup is needed to remove stale assumptions in scripts, docs, comments, and other repo wiring that still imply extensions are built artifacts or require per-extension build steps.

Scope: audit build scripts, package scripts, AGENTS/README/docs, and any extension-specific packaging logic for outdated references to extension dist outputs or extension build commands. Keep the cleanup focused on removing now-stale assumptions rather than redesigning the entire build system.

Validation should confirm that the repo still assembles dist/ correctly, sandpiper still loads extensions from source, and docs match the current architecture.

---

# Activity Log

## 2026-03-30T18:57:04.102Z

- **description**: added (5 lines)

## 2026-03-30T18:57:04.152Z

- **status**: NOT STARTED → IN PROGRESS
- **assignee**: UNASSIGNED → AGENT

## 2026-03-30T19:02:25.244Z

- **status**: IN PROGRESS → NEEDS REVIEW
