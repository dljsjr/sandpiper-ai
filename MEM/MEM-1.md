---
title: "Design memory/brain system for cross-session knowledge retrieval"
status: COMPLETE
resolution: WONTFIX
kind: TASK
priority: MEDIUM
assignee: UNASSIGNED
reporter: USER
created_at: 2026-03-25T03:14:28.312Z
updated_at: 2026-10-19T19:39:07.831Z
---

# Design memory/brain system for cross-session knowledge retrieval

Design the sandpiper memory/brain system for cross-session knowledge retrieval.

Current direction: core memory engine design has been spun out into the standalone Rust repo at ~/git/yaams (Yet Another Agent Memory System). YAAMS now owns the storage/retrieval engine, schema, search pipeline, and CLI dogfooding path. Relevant design docs live in:
- ~/git/yaams/docs/architecture.md
- ~/git/yaams/.sandpiper/docs/mvp-work-plan.md
- ~/git/yaams/.sandpiper/docs/future-phases.md

This MEM task should now be interpreted as sandpiper-side integration and productization work around YAAMS rather than re-designing the storage engine in-repo. Future follow-up likely includes extension integration, memory prompt injection, extraction orchestration, and session-boundary flushing.

---

# Activity Log

## 2026-03-25T03:14:41.163Z

- **description**: added (11 lines)

## 2026-04-03T22:49:50.060Z

- **description**: 11 lines → updated (8 lines)

## 2026-10-19T19:39:07.831Z

- **status**: NOT STARTED → COMPLETE
- **resolution**: WONTFIX
