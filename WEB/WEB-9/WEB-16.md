---
title: "Implement Markdown section targeted extraction"
status: COMPLETE
resolution: DONE
kind: SUBTASK
priority: MEDIUM
assignee: AGENT
reporter: USER
created_at: 2026-05-13T21:57:46.919Z
updated_at: 2026-05-14T05:08:00.432Z
---

# Implement Markdown section targeted extraction

Implement Markdown/block targeting for `web_fetch`, most likely by section heading after HTML-to-Markdown conversion.

Acceptance criteria:
- Caller can request a specific Markdown section/header or block identifier.
- Matching section returns only that section's content, including appropriate nested subsections.
- Missing section gracefully falls back to the default full extract and includes explanatory metadata.
- Tests cover exact heading match, nested section behavior, and missing heading fallback.
- Tool input schema exposes the Markdown/block targeting parameter.

---

# Activity Log

## 2026-05-13T21:58:03.577Z

- **description**: updated

## 2026-05-14T03:54:11.387Z

- **status**: NOT STARTED → IN PROGRESS
- **assignee**: UNASSIGNED → AGENT

## 2026-05-14T04:02:35.142Z

- **status**: IN PROGRESS → NEEDS REVIEW

## 2026-05-14T05:08:00.433Z

- **status**: NEEDS REVIEW → COMPLETE
- **resolution**: DONE
