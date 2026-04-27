---
title: "web_fetch: markdown_section heading match too brittle (fails on bracketed/dated headings like '## [0.80.1] - 2026-06-23')"
status: NOT STARTED
kind: BUG
priority: MEDIUM
assignee: UNASSIGNED
reporter: USER
created_at: 2026-06-23T20:12:02.803Z
updated_at: 2026-06-23T20:12:02.803Z
---

# web_fetch: markdown_section heading match too brittle (fails on bracketed/dated headings like '## [0.80.1] - 2026-06-23')

markdown_section heading matching does not find an obviously-present section when the on-page heading carries link markup or a trailing suffix.

REPRO (2026-06-23 dogfood, Pi CHANGELOG):
- Headings are of the form '## [0.80.1] - 2026-06-23' (Keep-a-Changelog style: version wrapped in a link reference, trailing ' - <date>').
- filter {type: markdown_section, heading: '0.80.1'} matched nothing.

FIX DIRECTION: normalize heading text before comparison and support substring/normalized matching rather than strict exact-string equality:
- strip link markup so '[0.80.1]' -> '0.80.1'
- ignore trailing decorations (e.g. ' - 2026-06-23') for match purposes
- case-insensitive, whitespace-collapsed substring match as the default, with exact-match available if needed.

RELATED: pairs with the content-type bug above; verify against the WEB-16 contract to confirm whether brittle exact-match was intended (then this is an enhancement) or unintended (defect). Either way the current behavior makes the feature hard to drive without first reading the doc to discover exact heading strings, which defeats the point of targeted extraction.
