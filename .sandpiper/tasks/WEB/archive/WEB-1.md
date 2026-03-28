---
title: "Web fetch tool: fetch URL, extract content, return markdown"
status: COMPLETE
resolution: DONE
kind: TASK
priority: MEDIUM
assignee: UNASSIGNED
reporter: USER
created_at: 2026-03-25T03:15:05.788Z
updated_at: 2026-03-26T20:58:12.383Z
---

# Web fetch tool: fetch URL, extract content, return markdown

Fetch a URL and return clean, token-efficient markdown content for the agent.

Pipeline: fetch() → jsdom → @mozilla/readability → turndown → TOON envelope
Architecture: Pi extension with framework-independent core + adapter interface
Full design: .sandpiper/docs/web-fetch-prd.md

---

# Activity Log

## 2026-03-25T03:15:31.395Z

- **description**: added (13 lines)

## 2026-03-26T04:38:18.367Z

- **description**: 13 lines → updated (45 lines)

## 2026-03-26T20:49:54.852Z

- **title**: Headless web browsing, fetching, and browser automation tool → Web fetch tool: fetch URL, extract content, return markdown
- **description**: 45 lines → updated (5 lines)

## 2026-03-26T20:58:12.383Z

- **status**: NOT STARTED → COMPLETE
- **resolution**: DONE
