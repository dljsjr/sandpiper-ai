---
title: "Fix startup-hooks Vitest mock failure"
status: COMPLETE
resolution: DONE
kind: BUG
priority: MEDIUM
assignee: UNASSIGNED
reporter: AGENT
created_at: 2026-05-05T22:48:35.783Z
updated_at: 2026-10-19T18:06:45.723Z
---

# Fix startup-hooks Vitest mock failure

AGENT-93 code-review noted extensions/system/startup-hooks.test.ts has a pre-existing Vitest vi.mock/importOriginal factory issue. It is unchanged by the AGENT-93 extraction stack but should be rewritten so the test can run in normal changed-test/full-suite workflows.

---

# Activity Log

## 2026-05-05T22:48:42.143Z

- **description**: added (1 line)

## 2026-10-19T18:06:45.658Z

- **status**: NOT STARTED → NEEDS REVIEW

## 2026-10-19T18:06:45.723Z

- **status**: NEEDS REVIEW → COMPLETE
- **resolution**: DONE
