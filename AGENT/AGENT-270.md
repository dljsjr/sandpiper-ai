---
title: "Keep inline XML tag references editable in prompt editor"
status: NEEDS REVIEW
kind: BUG
priority: HIGH
assignee: "Piper"
reporter: USER
created_at: 2026-08-11T16:42:48.062Z
updated_at: 2026-08-11T16:43:30.319Z
related:
  - AGENT-269
---

# Keep inline XML tag references editable in prompt editor

The prompt markup projector mistakes inline prose references such as `<agency>` in Roux/AGENTS.md for structural sections. Classify only structural element tags as immutable/navigation anchors; keep inline tag references and XML comments editable, including in locked/generated navigation labels where references are not real sections.

---

# Activity Log

## 2026-08-11T16:42:48.159Z

- **status**: NOT STARTED → IN PROGRESS
- **assignee**: UNASSIGNED → Piper

## 2026-08-11T16:42:53.355Z

- **description**: added (1 line)

## 2026-08-11T16:43:30.320Z

- **status**: IN PROGRESS → NEEDS REVIEW
