---
title: "Move web_fetch llms.txt metadata into tool result content; suppress when missing"
status: COMPLETE
resolution: DONE
kind: TASK
priority: MEDIUM
assignee: "Piper"
reporter: USER
created_at: 2026-06-30T03:57:44.371Z
updated_at: 2026-06-30T06:20:17.571Z
---

# Move web_fetch llms.txt metadata into tool result content; suppress when missing

Background: WEB-14 added passive llms.txt existence probing to web_fetch. The probe result currently lives in two places on every fetch: (a) the tool result's structured details.llmsTxt field (UI/audit only — Pi does NOT send details to the LLM); and (b) a separate <sandpiper_system_notification> block emitted via sendSystemNotification whenever llmsTxt.checked is true (always, since the probe always sets checked: true). The separate notification fires per fetch even when llms.txt is absent (the overwhelming common case), producing steady low-value context noise.

Goal: relocate llms.txt metadata into the tool result's content text (the part the LLM actually sees), and suppress the metadata block entirely when llms.txt is absent.

Approach:
- Update extensions/web-fetch/src/index.ts (and/or tool-operation.ts) so that the probe metadata is appended to the formatted content text as a structured XML block (matching the <skill> tool's <additional_content> pattern), only when llmsTxt.exists === true.
- Drop the sendSystemNotification call in web_fetch's execute; the metadata now travels with the page content.
- Keep details.llmsTxt populated for UI/logging/audit consumers.
- Preserve all existing structured outputs (title, byline, excerpt, links, filter outcome).

Tests:
- extensions/web-fetch/src/tool-operation.test.ts: assert that the returned content text contains a structured llms_txt metadata block when llmsTxt.exists === true, and does NOT when exists === false or undefined.
- extensions/web-fetch/src/index.test.ts: assert no sendSystemNotification call (or stub the call surface and assert it was not invoked) when llmsTxt is missing; assert the formatted content carries the metadata when present.
- bun run test:vitest -- extensions/web-fetch passes.
- bun check stays clean.

Out of scope:
- Removing details.llmsTxt (keep for UI/audit).
- Refactoring the probe itself.
- Touching other tools' notification patterns.

Refs: WEB-14 (original probe), inbox/webfetch-llms-txt-metadata-reporting.md.

---

# Activity Log

## 2026-06-30T05:45:46.188Z

- **status**: NOT STARTED → IN PROGRESS
- **assignee**: UNASSIGNED → Piper

## 2026-06-30T05:48:36.691Z

- **status**: IN PROGRESS → NEEDS REVIEW

## 2026-06-30T06:20:17.576Z

- **status**: NEEDS REVIEW → COMPLETE
- **resolution**: DONE
