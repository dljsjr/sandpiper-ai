---
title: "Implement CSS selector targeting in web_fetch"
status: NOT STARTED
kind: TASK
priority: MEDIUM
assignee: UNASSIGNED
reporter: AGENT
created_at: 2026-04-01T15:29:49.112Z
updated_at: 2026-04-01T15:30:09.621Z
---

# Implement CSS selector targeting in web_fetch

The web_fetch pipeline already accepts a `selector?: string` parameter in PipelineOptions, with a JSDoc comment marking it 'not yet implemented'. This was part of the original PRD tool API spec but was deferred from the MVP.

## What to implement

After Readability extraction, apply the CSS selector to the extracted DOM (via jsdom) and narrow the content to the matching region before running it through Turndown. If no element matches the selector, fall back to the full Readability extract with an informational note in the response metadata.

## Acceptance criteria

- `selector` parameter works end-to-end through fetchAndExtract
- Tests cover: selector matches content, selector matches nothing (graceful fallback), selector on minimal page
- The 'not yet implemented' JSDoc comment is removed
- The tool registration in index.ts exposes selector in the input schema

## References

- `extensions/web-fetch/src/pipeline.ts` — PipelineOptions.selector
- `.sandpiper/docs/web-fetch-prd.md` — original tool API spec

---

# Activity Log

## 2026-04-01T15:30:09.621Z

- **description**: added (17 lines)
