---
title: "Honor outputPad in chorus and tattler custom message renderers"
status: COMPLETE
resolution: DONE
kind: SUBTASK
priority: LOW
assignee: UNASSIGNED
reporter: AGENT
created_at: 2026-08-06T20:42:18.399Z
updated_at: 2026-08-06T23:46:02.521Z
depends_on:
  - AGENT-236
---

# Honor outputPad in chorus and tattler custom message renderers

0.82.1 (#7045) exposed the outputPad setting to custom message renderers. extensions/chorus/chorus-ui.ts createChorusMessageComponent and extensions/tattler/tattler-inbox-renderer.ts currently ignore it; honor it for consistency with built-in transcript rendering, especially under fullscreen padding behavior (0.84.0 also fixed interactive errors ignoring configured output padding).

---

# Activity Log

## 2026-08-06T23:46:02.457Z

- **status**: NOT STARTED → NEEDS REVIEW

## 2026-08-06T23:46:02.522Z

- **status**: NEEDS REVIEW → COMPLETE
- **resolution**: DONE
