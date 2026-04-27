---
title: "Implement targeted extraction in web_fetch"
status: COMPLETE
resolution: DONE
kind: TASK
priority: HIGH
assignee: AGENT
reporter: AGENT
created_at: 2026-04-01T15:29:49.112Z
updated_at: 2026-05-14T05:08:23.208Z
---

# Implement targeted extraction in web_fetch

Add targeted extraction support to `web_fetch` so callers can narrow the returned content to the relevant part of a page.

This parent task tracks two targeting modes:
- CSS selector targeting against the extracted/readable DOM.
- Markdown/block targeting, likely by section header, after conversion.

The goal is to reduce token noise while preserving graceful fallback behavior. Targeting failures should not fail the whole fetch; they should return the default full extract plus explanatory metadata.

---

# Activity Log

## 2026-04-01T15:30:09.621Z

- **description**: added (17 lines)

## 2026-04-01T16:30:37.271Z

- **priority**: MEDIUM → HIGH

## 2026-05-13T21:57:05.831Z

- **title**: Implement CSS selector targeting in web_fetch → Implement targeted extraction in web_fetch
- **description**: 17 lines → updated (7 lines)

## 2026-05-13T21:57:28.328Z

- **description**: updated

## 2026-05-14T03:20:18.487Z

- **status**: NOT STARTED → IN PROGRESS
- **assignee**: UNASSIGNED → AGENT

## 2026-05-14T05:08:00.493Z

- **status**: IN PROGRESS → NEEDS REVIEW

## 2026-05-14T05:08:23.209Z

- **status**: NEEDS REVIEW → COMPLETE
- **resolution**: DONE
