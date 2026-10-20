---
title: "Remove active dependencies on the retired bundled code-review skill"
status: COMPLETE
resolution: DONE
kind: SUBTASK
priority: MEDIUM
assignee: AGENT
reporter: USER
created_at: 2026-10-28T17:55:43.797Z
updated_at: 2026-10-28T18:22:55.392Z
---

# Remove active dependencies on the retired bundled code-review skill

Inventory active global/project guidance and retained prompts. Replace hard requirements on the deleted built-in with existing review guidance or optional installed-skill use, without redesigning SOPs/prompts. Distinguish generic code-review terminology, prompt names, fixtures, historical records and independent installed copies. Preserve unrelated guidance and user state.

## Implementation and verification — 2026-10-28

Implemented in canonical global guidance ptvmqonr/6652aa63 and Sandpiper lqwxrkwp/83679fb9. Global reviewer ROLE.md no longer requires the deleted skill and retains its existing review workflow; code-health.md drops the retired skill references. Retained code-review/self-reflect prompts use applicable review skills only when available; their procedures and names were not redesigned. Independent active-routing inventory finds no remaining hard dependency on the removed bundled skill. A verification example in the June draft for completed AGENT-35 is historical, not runtime routing, and remains unchanged. Other generic code-review prose, fixture data and independent installed copies are preserved.

---

# Activity Log

## 2026-10-28T17:57:01.523Z

- **status**: NOT STARTED → IN PROGRESS
- **assignee**: UNASSIGNED → AGENT

## 2026-10-28T18:08:11.839Z

- **description**: 1 line → updated (5 lines)

## 2026-10-28T18:08:11.900Z

- **status**: IN PROGRESS → NEEDS REVIEW

## 2026-10-28T18:22:55.393Z

- **status**: NEEDS REVIEW → COMPLETE
- **resolution**: DONE
