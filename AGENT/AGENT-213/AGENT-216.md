---
title: "docs: document the prompt-contributor event-bus convention in sandpiper-ai public docs"
status: COMPLETE
resolution: DONE
kind: SUBTASK
priority: MEDIUM
assignee: "Piper"
reporter: "Roux"
created_at: 2026-06-09T22:45:05.800Z
updated_at: 2026-06-10T04:27:55.470Z
---

# docs: document the prompt-contributor event-bus convention in sandpiper-ai public docs

Owner: Piper (Librarian). Document the prompt-contribution protocol in sandpiper-ai's public-facing docs.

- Channel name, payload contract ({ id, phase?, getContent }), and the lifecycle rendezvous (subscribe in session_start, emit in resources_discover, assemble in before_agent_start).
- Contract rules: synchronous enqueue in listener, async work in getContent, dedupe by id, build-once/freeze for prefix-cache stability.
- Apply Diataxis: reference + how-to, not policy prose.
- Coordinate final names/shape with Huginn.

---

# Activity Log

## 2026-06-09T22:45:11.055Z

- **status**: NOT STARTED → IN PROGRESS
- **assignee**: UNASSIGNED → Piper

## 2026-06-09T22:57:03.276Z

- **status**: IN PROGRESS → NEEDS REVIEW

## 2026-06-10T04:27:55.471Z

- **status**: NEEDS REVIEW → COMPLETE
- **resolution**: DONE
