---
title: "Headless web browsing, fetching, and browser automation tool"
status: NOT STARTED
kind: TASK
priority: MEDIUM
assignee: UNASSIGNED
reporter: USER
created_at: 2026-03-25T03:15:05.788Z
updated_at: 2026-03-26T04:38:18.366Z
---

# Headless web browsing, fetching, and browser automation tool

Build a tool (pi extension or CLI) for headless web browsing, content fetching, and potentially browser automation.

## Use Cases

- Fetch and read web pages (documentation, API references, GitHub issues)
- Extract text content from URLs (strip HTML, return readable text)
- Browser automation for testing or scraping
- JS-rendered page content extraction

## Implementation Layers

1. Simple fetch + HTML-to-text (MVP — just curl + readability extraction)
2. Headless browser for JS-rendered pages
3. Browser automation for interactive workflows

## Options to Evaluate

### Lightpanda (github.com/lightpanda-io/browser)
Headless browser built from scratch in Zig, designed specifically for AI agents and automation:
- Not a Chromium fork — purpose-built for headless usage
- 11x faster execution, 9x less memory than Chrome
- Instant startup (no heavy browser initialization)
- CDP (Chrome DevTools Protocol) compatible — works with Playwright, Puppeteer, chromedp
- JS execution + partial Web API support (WIP)
- macOS aarch64 binary available (nightly builds)
- Lightweight: single binary, no graphical rendering

### Puppeteer / Playwright
- Full Chromium-based browsers — complete Web API support
- Heavy: RAM and CPU intensive, slow startup
- Well-tested, mature ecosystem
- Playwright has better multi-browser support

### Simple fetch + readability
- No JS execution — can't handle SPAs or JS-rendered content
- Lightest weight: just HTTP + HTML parsing
- Good enough for static documentation pages
- Could use Mozilla Readability or similar extraction library

## Considerations

- Existing MCP servers for web browsing (evaluate before building)
- Security implications of arbitrary URL fetching
- Could wrap an MCP server via mcporter (same pattern as Dash)
- pi's existing tool ecosystem — what already exists?

---

# Activity Log

## 2026-03-25T03:15:31.395Z

- **description**: added (13 lines)

## 2026-03-26T04:38:18.367Z

- **description**: 13 lines → updated (45 lines)
