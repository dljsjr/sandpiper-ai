---
title: "startup-hooks.test.ts vi.mock factory fails: importOriginal is undefined"
status: NOT STARTED
kind: BUG
priority: LOW
assignee: UNASSIGNED
reporter: AGENT
created_at: 2026-05-05T22:49:00.189Z
related:
  - AGENT-93
updated_at: 2026-05-06T04:07:01.418Z
---

# startup-hooks.test.ts vi.mock factory fails: importOriginal is undefined

The test file at `extensions/system/startup-hooks.test.ts` uses `vi.mock('../../packages/core/src/system-prompt.js', async (importOriginal) => ...)` but the Vitest factory parameter `importOriginal` is `undefined` when called via Bun's test runner. This prevents the test from running and causes errors on every test run.

The mock was used to intercept `buildSandpiperSystemPrompt`, but after AGENT-158 extracted the startup prompt boundary into `buildSandpiperStartupPrompt` (in `packages/core/src/startup-prompt.ts`), the test's approach may need rethinking — the adapter now calls `buildSandpiperStartupPrompt` which has its own DI seam, so the mock target may have shifted.

Pre-existing before the AGENT-93 extraction slices. Not introduced by AGENT-156 through AGENT-165.

---

# Activity Log

## 2026-05-05T22:49:32.942Z

- **description**: added (5 lines)
- **related**: (none) → AGENT-93

## 2026-05-05T22:49:52.983Z

- **status**: NOT STARTED → IN PROGRESS
- **assignee**: UNASSIGNED → AGENT

## 2026-05-06T04:07:01.419Z

- **status**: IN PROGRESS → NOT STARTED
- **assignee**: AGENT → UNASSIGNED
