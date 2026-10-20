---
title: "web_fetch: raw markdown served as text/plain bypasses structure parsing, breaking markdown_section/css_selector"
status: COMPLETE
resolution: DONE
kind: BUG
priority: HIGH
assignee: AGENT
reporter: USER
created_at: 2026-06-23T20:12:02.717Z
updated_at: 2026-11-12T16:29:12.949Z
---

# web_fetch: raw markdown served as text/plain bypasses structure parsing, breaking markdown_section/css_selector

## Implemented (2026-11-11)

Change zvyxysny / fa49e515. Cause confirmed by test: the pipeline had no content-type branch, so every body was parsed as HTML and a raw Markdown file lost its line structure.

- The fetch adapter records the response media type (FetchResult.contentType). FetchResult.html is renamed to body.
- Bodies served as text/markdown, text/x-markdown or text/plain skip Readability and Turndown, are returned unchanged, and go to the Markdown section filter as they are. No URL-extension or content sniffing: the media type alone decides.
- followLinks reads links from the Markdown. A CSS selector on a text body returns an explanatory error.
- The tool description says Markdown and plain-text responses are returned unchanged.

Verification, isolated checkout: each behavior was a failing test first (5 pipeline tests, 1 adapter test, against a real local HTTP server). bun check clean. Full serial suite with WEB-19: 65 files, 547 tests passed. Live probe of raw.githubusercontent.com keep-a-changelog CHANGELOG.md with heading 1.1.0: old code returned no match; new code returned the section. Not live until the next install and build.

Targeted extraction (WEB-9/WEB-16) silently matches nothing when the payload is real markdown served with a non-HTML content-type.

REPRO (2026-06-23 dogfood, Pi CHANGELOG):
- Fetching https://raw.githubusercontent.com/.../CHANGELOG.md returns content labeled 'Format: Plain text'. The raw endpoint serves text/plain, so web_fetch never runs the HTML->markdown structure path. markdown_section has no heading tree to bind to.
- filter {type: markdown_section, heading: '0.80.1'} -> 'No content matched Markdown section: 0.80.1' even though the section exists.

ROOT CAUSE (hypothesis): selector/section extraction operates on the post-readability structured representation; a text/plain (or .md) payload is treated as opaque body text and never sectioned.

FIX DIRECTION: detect markdown payloads by content-type (text/markdown) AND by URL extension (.md/.markdown) AND/or by sniffing, and route them through the markdown structure parser so markdown_section and css-equivalent filters work. A raw .md file is the single most natural input for markdown_section — it should be the happy path, not the dead path.

IMPACT: the feature is unusable for its most obvious use case (pulling one section out of a long raw markdown doc). Forced fallback to gh api + local slicing.

---

# Activity Log

## 2026-11-11T22:34:33.792Z

- **status**: NOT STARTED → IN PROGRESS
- **assignee**: UNASSIGNED → AGENT

## 2026-11-11T22:39:36.306Z

- **description**: 11 lines → updated (22 lines)

## 2026-11-11T22:39:36.606Z

- **status**: IN PROGRESS → NEEDS REVIEW

## 2026-11-12T16:29:12.950Z

- **status**: NEEDS REVIEW → COMPLETE
- **resolution**: DONE
