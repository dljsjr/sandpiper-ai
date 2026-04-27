---
title: "web_fetch: raw markdown served as text/plain bypasses structure parsing, breaking markdown_section/css_selector"
status: NOT STARTED
kind: BUG
priority: HIGH
assignee: UNASSIGNED
reporter: USER
created_at: 2026-06-23T20:12:02.717Z
updated_at: 2026-06-23T20:12:02.717Z
---

# web_fetch: raw markdown served as text/plain bypasses structure parsing, breaking markdown_section/css_selector

Targeted extraction (WEB-9/WEB-16) silently matches nothing when the payload is real markdown served with a non-HTML content-type.

REPRO (2026-06-23 dogfood, Pi CHANGELOG):
- Fetching https://raw.githubusercontent.com/.../CHANGELOG.md returns content labeled 'Format: Plain text'. The raw endpoint serves text/plain, so web_fetch never runs the HTML->markdown structure path. markdown_section has no heading tree to bind to.
- filter {type: markdown_section, heading: '0.80.1'} -> 'No content matched Markdown section: 0.80.1' even though the section exists.

ROOT CAUSE (hypothesis): selector/section extraction operates on the post-readability structured representation; a text/plain (or .md) payload is treated as opaque body text and never sectioned.

FIX DIRECTION: detect markdown payloads by content-type (text/markdown) AND by URL extension (.md/.markdown) AND/or by sniffing, and route them through the markdown structure parser so markdown_section and css-equivalent filters work. A raw .md file is the single most natural input for markdown_section — it should be the happy path, not the dead path.

IMPACT: the feature is unusable for its most obvious use case (pulling one section out of a long raw markdown doc). Forced fallback to gh api + local slicing.
