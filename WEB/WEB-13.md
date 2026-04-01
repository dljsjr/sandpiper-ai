---
title: "Spike: browser automation tool for interactive and JS-heavy pages"
status: NOT STARTED
kind: TASK
priority: LOW
assignee: UNASSIGNED
reporter: AGENT
created_at: 2026-04-01T15:33:28.199Z
updated_at: 2026-04-01T15:33:42.994Z
related:
  - WEB-10
---

# Spike: browser automation tool for interactive and JS-heavy pages

The web-fetch PRD explicitly punted browser automation (scope 4) as 'valuable for personal-assistant agents but not a priority for a coding agent.' This ticket captures that deferral for future triage rather than letting the idea go untracked.

## What this could look like

A browser automation tool would go beyond fetch+extract by driving a real browser instance: clicking, form submission, authentication flows, and navigating multi-step interactions. Possible backends:

- **Playwright** — robust, cross-browser, good Node.js API, widely used
- **Puppeteer** — Chromium-focused, lighter weight
- **lightpanda** — compiled native binary, minimal overhead (also tracked in WEB-10 as a rendering adapter)

## Potential capabilities

- Navigate to a URL and interact with the page (click, type, scroll)
- Screenshot capture for visual inspection
- Handle login/auth flows (cookies, sessions)
- Fill and submit forms
- Wait for dynamic content to load
- Extract content from JS-rendered pages (overlaps with WEB-10)

## Why it was punted

The original PRD reasoning: most coding agent web reads are SSR (docs, GitHub, npm, MDN). Browser automation adds significant complexity, a heavyweight dependency, and security surface area in exchange for capability that has limited coding-agent use cases today.

## Triage prompt

Re-evaluate when:
- WEB-10 (JS rendering adapter) is implemented and still leaves real gaps
- There is a concrete personal use case (filling forms, interacting with a web app, etc.)

## References

- `.sandpiper/docs/web-fetch-prd.md` — Deferred capabilities, Scope 4 (Browser automation)
- WEB-10 — JS rendering adapter (related, lighter-weight alternative)

---

# Activity Log

## 2026-04-01T15:33:42.994Z

- **description**: added (33 lines)
