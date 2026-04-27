---
title: "Add offline system prompt diagnostic binary"
status: COMPLETE
resolution: DONE
kind: TASK
priority: HIGH
assignee: "Piper"
reporter: USER
created_at: 2026-08-10T21:47:07.224Z
updated_at: 2026-08-13T21:57:45.494Z
---

# Add offline system prompt diagnostic binary

Add a Sandpiper-owned CLI binary that discovers the same tools, skills, context, extensions, identity override, and appended prompt content as the normal harness, renders the effective Sandpiper system prompt without sending a request to a model, writes the complete prompt to stdout, and can be used as birdup --runner. Preserve normal Sandpiper CLI behavior and package/distribution entrypoints.

---

# Activity Log

## 2026-08-10T21:47:12.059Z

- **status**: NOT STARTED → IN PROGRESS
- **assignee**: UNASSIGNED → Piper

## 2026-08-10T22:06:47.476Z

- **status**: IN PROGRESS → NEEDS REVIEW

## 2026-08-13T21:57:45.495Z

- **status**: NEEDS REVIEW → COMPLETE
- **resolution**: DONE
