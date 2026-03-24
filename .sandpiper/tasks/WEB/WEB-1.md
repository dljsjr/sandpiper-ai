---
title: "Headless web browsing, fetching, and browser automation tool"
status: NOT STARTED
kind: TASK
priority: MEDIUM
assignee: UNASSIGNED
reporter: USER
created_at: 2026-03-25T03:15:05.788Z
updated_at: 2026-03-25T03:15:31.395Z
---

# Headless web browsing, fetching, and browser automation tool

Build a tool (pi extension or CLI) for headless web browsing, content fetching, and potentially browser automation.

Use cases:
- Fetch and read web pages (documentation, API references, GitHub issues)
- Extract text content from URLs (strip HTML, return readable text)
- Browser automation for testing or scraping (Puppeteer/Playwright)

Likely implementation layers:
1. Simple fetch + HTML-to-text (MVP — just curl + readability extraction)
2. Headless browser for JS-rendered pages (Puppeteer)
3. Browser automation for interactive workflows (Playwright)

Consider: existing MCP servers for web browsing, pi's existing tool ecosystem, security implications of arbitrary URL fetching.

---

# Activity Log

## 2026-03-25T03:15:31.395Z

- **description**: added (13 lines)
