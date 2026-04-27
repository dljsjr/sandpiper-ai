---
title: "Map classifier labels to guidance snippets"
status: COMPLETE
resolution: WONTFIX
kind: SUBTASK
priority: MEDIUM
assignee: UNASSIGNED
reporter: AGENT
created_at: 2026-04-09T01:39:55.202Z
updated_at: 2026-05-14T14:04:08.301Z
---

# Map classifier labels to guidance snippets

Map classifier output labels to existing guidance snippets.

## Current State
- Classifier outputs: heavy | light | assess | none
- Regex system outputs: full | short | review | none

## Mapping
- heavy → GUIDANCE_TEXT_FULL
- light → GUIDANCE_TEXT_SHORT
- assess → GUIDANCE_TEXT_REVIEW
- none → (no injection)

## Work Items

- [ ] Update `AuxGuidanceMode` type from 'full' | 'short' | 'review' | 'none' to 'heavy' | 'light' | 'assess' | 'none'
- [ ] Update `renderGuidance()` switch cases
- [ ] Update `AuxGuidanceInjectionEvent.mode` type
- [ ] Update any logging/observability that references mode names

---

# Activity Log

## 2026-04-09T01:40:41.854Z

- **description**: added (18 lines)

## 2026-05-14T14:04:08.308Z

- **status**: NOT STARTED → COMPLETE
- **resolution**: WONTFIX
