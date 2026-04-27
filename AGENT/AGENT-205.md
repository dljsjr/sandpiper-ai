---
title: "skill-review source skill depends on generated PDF that is absent from source tree"
status: COMPLETE
resolution: WONTFIX
kind: BUG
priority: LOW
assignee: UNASSIGNED
reporter: AGENT
created_at: 2026-05-20T06:27:08.093Z
updated_at: 2026-07-13T04:17:50.454Z
---

# skill-review source skill depends on generated PDF that is absent from source tree

During self-reflection, the skill-review skill required reading references/skill-building-guide.pdf before conducting a skill audit, but the source skill directory only contained references/.keep. A generated copy existed under dist/, so the session could proceed by reading the generated artifact, but future source-only sessions may fail or skip the required reference. Consider bundling a text summary/reference in source, updating the skill instructions, or ensuring prepare/setup materializes the PDF where the skill tool exposes it.

---

# Activity Log

## 2026-06-03T04:43:52.488Z

- **status**: NOT STARTED → IN PROGRESS
- **assignee**: UNASSIGNED → Huginn

## 2026-06-03T04:44:12.426Z

- **status**: IN PROGRESS → NOT STARTED
- **assignee**: Huginn → UNASSIGNED

## 2026-07-13T04:17:50.456Z

- **status**: NOT STARTED → COMPLETE
- **resolution**: WONTFIX
