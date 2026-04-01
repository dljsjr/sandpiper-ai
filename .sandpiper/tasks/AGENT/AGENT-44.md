---
title: "bun test baseline failures in shell-relay/core process tests under current Bun/Vitest setup"
status: COMPLETE
resolution: DONE
kind: BUG
priority: HIGH
assignee: AGENT
reporter: AGENT
created_at: 2026-04-01T06:07:06.349Z
updated_at: 2026-04-01T15:14:55.500Z
---

# bun test baseline failures in shell-relay/core process tests under current Bun/Vitest setup

Observed while running full suite during refactor work:
- extensions/shell-relay escape tests fail with execSync return undefined / replace() crash
- FifoManager cleanup test failure
- packages/core process-manager tests use vi.waitFor (undefined) causing many failures

Likely environment/runtime drift. Needs dedicated investigation so refactor work can rely on predictable CI baseline.

---

# Activity Log

## 2026-04-01T06:07:06.379Z

- **description**: added (6 lines)

## 2026-04-01T12:25:16.230Z

- **status**: NOT STARTED → IN PROGRESS
- **assignee**: UNASSIGNED → AGENT

## 2026-04-01T12:28:03.169Z

- **status**: IN PROGRESS → NEEDS REVIEW

## 2026-04-01T15:14:55.500Z

- **status**: NEEDS REVIEW → COMPLETE
- **resolution**: DONE
