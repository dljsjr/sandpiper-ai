---
title: "Spike: single-query web search tool (fetch top N results from a search API)"
status: COMPLETE
resolution: DONE
kind: TASK
priority: MEDIUM
assignee: "Piper"
reporter: AGENT
created_at: 2026-04-01T15:29:49.175Z
updated_at: 2026-07-11T16:53:29.597Z
---

# Spike: single-query web search tool (fetch top N results from a search API)

## Design Decisions (2026-06-07)

**Architecture:** New Pi extension at `extensions/web-search/`, mirroring `web-fetch`'s structure. Registers a `web_search` tool via `pi.registerTool`.

**Adapter pattern:** `SearchAdapter` interface (mirroring `FetchAdapter`) with pluggable backends:
- **Brave Search API** — primary adapter. Independent index, 2k queries/month free, clean JSON API. Key via `BRAVE_API_KEY` env var or `braveApiKey` in settings.json. Supports `!op read` pattern.
- **Parallel MCP** — no-key fallback. Free endpoint at `https://search.parallel.ai/mcp`. Uses mcporter's `createRuntime` with programmatic server definition (no config.json needed). MCP wire protocol: initialize → tools/call → parse content[0].text JSON.
- **DDG HTML scraping** — last-resort fallback. Zero-config but CAPTCHAs on first request from server-side code.

**Result shape:** `{title: string, url: string, snippet: string}[]` — structured results, same contract regardless of backend.

**Composition:** `web_search` returns URLs; agent feeds them to `web_fetch` for full content. Clean sibling tools.

**Config surface:** API key via env var (`BRAVE_API_KEY`), settings.json under extension namespace, or Pi's `!cmd`/``/literal resolver pattern (mirrored in extension, ~15 lines).

**Scope boundary:** WEB-10 (JS/SPA rendering) is phase 2 — a separate `FetchAdapter` swap in web-fetch, not part of this tool.

## Status (2026-06-07)

Brave adapter built, tested, and live in harness. Parallel MCP adapter in progress. DDG adapter as last-resort fallback.

---

# Activity Log

## 2026-04-01T15:30:30.404Z

- **description**: added (23 lines)

## 2026-04-01T16:30:37.348Z

- **priority**: LOW → MEDIUM

## 2026-06-07T22:22:50.208Z

- **description**: 23 lines → updated (16 lines)

## 2026-06-07T22:22:59.442Z

- **status**: NOT STARTED → IN PROGRESS
- **assignee**: UNASSIGNED → Piper

## 2026-06-08T01:31:03.833Z

- **description**: 16 lines → updated (20 lines)

## 2026-06-08T01:34:14.749Z

- **status**: IN PROGRESS → NEEDS REVIEW

## 2026-06-08T05:10:24.698Z

- **description**: updated

## 2026-07-11T16:53:29.597Z

- **status**: NEEDS REVIEW → COMPLETE
- **resolution**: DONE
