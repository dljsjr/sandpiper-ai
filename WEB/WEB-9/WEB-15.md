---
title: "Implement CSS selector targeted extraction"
status: COMPLETE
resolution: DONE
kind: SUBTASK
priority: HIGH
assignee: AGENT
reporter: USER
created_at: 2026-05-13T21:57:46.865Z
updated_at: 2026-05-14T03:54:11.327Z
---

# Implement CSS selector targeted extraction

Implement CSS selector targeting for `web_fetch`.

Acceptance criteria:
- CSS selector parameter works end-to-end through the fetch/extract pipeline.
- Selector is applied at the appropriate DOM stage after readability/extraction.
- Matching selector narrows returned content to the selected region.
- Non-matching selector gracefully falls back to the default full extract and includes explanatory metadata.
- Tests cover selector match, selector miss, and minimal-page behavior.
- Tool input schema exposes the selector parameter.

---

# Activity Log

## 2026-05-13T21:58:03.524Z

- **description**: updated

## 2026-05-14T03:37:45.873Z

- **status**: NOT STARTED → IN PROGRESS
- **assignee**: UNASSIGNED → AGENT

## 2026-05-14T03:44:19.981Z

- **status**: IN PROGRESS → NEEDS REVIEW

## 2026-05-14T03:54:11.329Z

- **status**: NEEDS REVIEW → COMPLETE
- **resolution**: DONE
