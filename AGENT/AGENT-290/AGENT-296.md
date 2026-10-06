---
title: "Render per-tool toolGuidelines and honor hiddenTools in the Sandpiper tool block"
status: NOT STARTED
kind: SUBTASK
priority: HIGH
assignee: UNASSIGNED
reporter: AGENT
created_at: 2026-10-06T02:57:59.409Z
updated_at: 2026-10-06T15:51:34.015Z
depends_on:
  - AGENT-293
---

# Render per-tool toolGuidelines and honor hiddenTools in the Sandpiper tool block

Pi 1.0 moved tool guidelines from promptGuidelines into a per-tool toolGuidelines map and added hiddenTools. Update toolGuidanceBlock() in packages/core/src/system-prompt.ts per the migration spec.

Tests first: assert the rendered Guidelines block matches the 0.85.1 output for the same tools (the 22 bullets the discovery probe lost), and that hidden tools are absent from the tool list and guidelines.

Done when: those tests pass, bun check is clean, and bun run test is green.

History (2026-10-06): absorbed the tool-guideline coverage from AGENT-294, because tests are part of the implementation they verify.

---

# Activity Log

## 2026-10-06T15:51:34.016Z

- **description**: 1 line → updated (7 lines)
