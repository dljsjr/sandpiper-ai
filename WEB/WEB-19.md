---
title: "web_fetch: markdown_section heading match too brittle (fails on bracketed/dated headings like '## [0.80.1] - 2026-06-23')"
status: COMPLETE
resolution: DONE
kind: BUG
priority: MEDIUM
assignee: AGENT
reporter: USER
created_at: 2026-06-23T20:12:02.803Z
updated_at: 2026-11-12T16:29:13.021Z
---

# web_fetch: markdown_section heading match too brittle (fails on bracketed/dated headings like '## [0.80.1] - 2026-06-23')

## Implemented (2026-11-11)

Change nwttstnn / 2fb84e6f. Design agreed with Doug: both the HTML path and the text path meet at Markdown text; one real parser serves both; sections are sliced from the source by offset, not re-serialized.

- The hand-written line scanner is replaced by mdast-util-from-markdown 2.1.0, with mdast-util-to-string 4.0.0 for heading text. Both are pinned devDependencies compiled into the bundle.
- Matching rule (agent decision, easy to change): an exact match on normalized heading text wins. When there is none, headings that contain the requested text as a whole phrase match, so 0.80.1 finds "## [0.80.1] - 2026-06-23" but not "## [0.80.10]", and Install does not find Installation or Uninstall. Normalization ignores case, repeated whitespace, Markdown markup and square brackets on both sides.
- Now also handled: setext headings, reference links, CRLF sources. Only top-level headings are section boundaries, as before.
- The heading parameter description states the matching rule. The PRD pipeline section is updated.

WEB-16's contract required only an exact-match test, so strict equality was not a deliberate limit.

Verification, isolated checkout: failing tests first; a mutation that drops the word-boundary check fails 3 tests. bun check clean. Full serial suite: 65 files, 547 tests passed (12 new). Live probe as recorded in WEB-18. Not live until the next install and build.

markdown_section heading matching does not find an obviously-present section when the on-page heading carries link markup or a trailing suffix.

REPRO (2026-06-23 dogfood, Pi CHANGELOG):
- Headings are of the form '## [0.80.1] - 2026-06-23' (Keep-a-Changelog style: version wrapped in a link reference, trailing ' - <date>').
- filter {type: markdown_section, heading: '0.80.1'} matched nothing.

FIX DIRECTION: normalize heading text before comparison and support substring/normalized matching rather than strict exact-string equality:
- strip link markup so '[0.80.1]' -> '0.80.1'
- ignore trailing decorations (e.g. ' - 2026-06-23') for match purposes
- case-insensitive, whitespace-collapsed substring match as the default, with exact-match available if needed.

RELATED: pairs with the content-type bug above; verify against the WEB-16 contract to confirm whether brittle exact-match was intended (then this is an enhancement) or unintended (defect). Either way the current behavior makes the feature hard to drive without first reading the doc to discover exact heading strings, which defeats the point of targeted extraction.

---

# Activity Log

## 2026-11-11T22:34:34.604Z

- **status**: NOT STARTED → IN PROGRESS
- **assignee**: UNASSIGNED → AGENT

## 2026-11-11T22:39:36.536Z

- **description**: 12 lines → updated (25 lines)

## 2026-11-11T22:39:36.685Z

- **status**: IN PROGRESS → NEEDS REVIEW

## 2026-11-12T16:29:13.022Z

- **status**: NEEDS REVIEW → COMPLETE
- **resolution**: DONE
