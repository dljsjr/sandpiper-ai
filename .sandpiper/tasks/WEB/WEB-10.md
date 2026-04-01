---
title: "Add JS rendering adapter (lightpanda/Playwright) for SPA and JS-heavy pages"
status: NOT STARTED
kind: TASK
priority: LOW
assignee: UNASSIGNED
reporter: AGENT
created_at: 2026-04-01T15:29:49.144Z
updated_at: 2026-04-01T15:30:20.094Z
---

# Add JS rendering adapter (lightpanda/Playwright) for SPA and JS-heavy pages

The web-fetch PRD explicitly deferred JS rendering to v2 when 'real failure cases' arise. The FetchAdapter interface was designed to accommodate this: a LightpandaAdapter or PlaywrightAdapter could slot in without changing the pipeline or tool API.

## Motivation

Most sites an agent reads are SSR (docs, GitHub, npm, MDN). But some pages — SPAs, dashboards — require JS execution to render useful content. When a user provides a URL that returns empty or unhelpful content via the SimpleFetchAdapter, there should be a path to retry with a JS-capable backend.

## What to implement

- Evaluate lightpanda (compiled native binary) vs. Playwright (npm package) as the backend
- Implement an adapter wrapping the chosen backend, conforming to the FetchAdapter interface
- Decide on activation: opt-in flag, automatic fallback on empty readability result, or user-configurable
- Update the tool registration to expose the rendering mode option if opt-in

## References

- `extensions/web-fetch/src/types.ts` — FetchAdapter interface
- `.sandpiper/docs/web-fetch-prd.md` — deferred capabilities table, lightpanda design decision reasoning

---

# Activity Log

## 2026-04-01T15:30:20.094Z

- **description**: added (17 lines)
