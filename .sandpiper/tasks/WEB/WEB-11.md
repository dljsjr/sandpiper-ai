---
title: "Spike: single-query web search tool (fetch top N results from a search API)"
status: NOT STARTED
kind: TASK
priority: MEDIUM
assignee: UNASSIGNED
reporter: AGENT
created_at: 2026-04-01T15:29:49.175Z
updated_at: 2026-04-01T16:30:37.348Z
---

# Spike: single-query web search tool (fetch top N results from a search API)

The web-fetch PRD called single-query search 'a natural v2'. Rather than requiring the user to provide a URL, the agent could issue a search query and automatically fetch and extract the top N results.

## Motivation

Many agent tasks involve researching something: 'what is the current API for X', 'how do I do Y in Z framework'. Today the agent must know or guess a URL. A search tool would let it search first, then read the best results.

## Scope (spike)

This is a spike to evaluate:
- Which search API to use (DuckDuckGo instant, SearXNG self-hosted, Brave Search API, Tavily, etc.)
- Whether to fetch all N result pages in parallel or let the agent choose which to follow
- How to present results: merged ranked summary, separate fetched pages, or metadata list with manual follow-links
- Cost model: is a search API call + N fetches acceptable latency for a coding agent workflow?

## Success criteria for spike

- Document the chosen API and rationale
- Prototype a minimal implementation
- Report on latency and result quality for 3-5 representative queries

## References

- `.sandpiper/docs/web-fetch-prd.md` — Deferred capabilities, Scope 3

---

# Activity Log

## 2026-04-01T15:30:30.404Z

- **description**: added (23 lines)

## 2026-04-01T16:30:37.348Z

- **priority**: LOW → MEDIUM
