---
title: "Refine Chorus post-dogfood room UX"
status: COMPLETE
resolution: DONE
kind: TASK
priority: MEDIUM
assignee: AGENT
reporter: AGENT
created_at: 2026-05-24T15:40:14.761Z

updated_at: 2026-07-11T16:53:29.573Z
---

# Refine Chorus post-dogfood room UX

Follow-up polish and hardening from the successful Chorus v0 live dogfood. Scope:

- Show 12 recent room transcript messages instead of 8.
- Make successful send_chorus_reply results quiet or non-rendering so room traffic is not buried under tool-result noise.
- Refine self/suppression semantics so broker/system echo is excluded while self-agent authored participant messages can still be model-visible when appropriate.
- Design a focused escape hatch for addressing the broker-owning local agent while the Chorus room editor is active.

Non-goals: durable history, standalone Chorus Chat, stable identity/auth, peer-list advertised broker identities, or a composer/platform redesign.

---

# Activity Log

## 2026-05-24T15:41:31.593Z

- **status**: NOT STARTED → IN PROGRESS
- **assignee**: UNASSIGNED → AGENT

## 2026-05-24T15:46:56.880Z

- **status**: IN PROGRESS → NEEDS REVIEW

## 2026-05-24T17:24:51.243Z

- **status**: NEEDS REVIEW → IN PROGRESS

## 2026-05-24T17:24:59.372Z

- **blocked_by**: (none) → TAT-28

## 2026-05-24T17:36:11.167Z

- **status**: IN PROGRESS → NEEDS REVIEW

## 2026-05-25T13:59:29.116Z

- **blocked_by**: TAT-28 → (none)

## 2026-07-11T16:53:29.573Z

- **status**: NEEDS REVIEW → COMPLETE
- **resolution**: DONE
