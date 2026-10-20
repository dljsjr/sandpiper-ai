---
title: "Prefer the site's own Markdown version of a page"
status: COMPLETE
resolution: DONE
kind: SUBTASK
priority: MEDIUM
assignee: AGENT
reporter: AGENT
created_at: 2026-11-11T23:14:34.573Z
updated_at: 2026-11-12T16:29:12.805Z
---

# Prefer the site's own Markdown version of a page

Doug (2026-11-11): use a page's advertised Markdown version whenever it exists.

## Implemented (2026-11-11)

Change wovklrsw / 86a6078a.

- The request puts text/markdown first in Accept. Measured before the change: 3 of 6 documentation sites answer with Markdown directly (6 to 16 KB instead of 145 to 220 KB of HTML).
- When the answer is HTML and the page advertises rel=alternate type=text/markdown (Link header or link element), that URL is fetched in parallel with llms.txt discovery and its content returned. Title and description come from the HTML page; the result carries markdownSource and the tool output shows a 'Markdown source:' line.
- Same origin only; must answer with a text media type, else the HTML is converted as before. No .md URL guessing. A CSS selector filter asks for HTML and ignores the Markdown version.

Live: docs.anthropic.com overview returns negotiated Markdown (6 KB); bun.com and vitest.dev pages return their advertised .md versions.

---

# Activity Log

## 2026-11-11T23:22:40.853Z

- **status**: NOT STARTED → IN PROGRESS
- **assignee**: UNASSIGNED → AGENT

## 2026-11-11T23:22:41.610Z

- **description**: added (11 lines)

## 2026-11-11T23:22:42.419Z

- **status**: IN PROGRESS → NEEDS REVIEW

## 2026-11-12T16:29:12.806Z

- **status**: NEEDS REVIEW → COMPLETE
- **resolution**: DONE
