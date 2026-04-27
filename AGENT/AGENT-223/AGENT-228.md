---
title: "Name inline extension factories for standalone distribution"
status: COMPLETE
resolution: DONE
kind: SUBTASK
priority: LOW
assignee: AGENT
reporter: USER
created_at: 2026-07-10T15:48:37.120Z
depends_on:
  - AGENT-224
updated_at: 2026-07-10T20:52:56.170Z
---

# Name inline extension factories for standalone distribution

Wrapped all 8 inline extension factories in packages/cli/sandpiper_resources.ts as named InlineExtension objects ({ name, factory }) instead of bare ExtensionFactory functions: sandpiper-identity, sandpiper-neutral-capability, web-fetch, web-search, autotoon, tattler, chorus, sandpiper-resources. These now show as <inline:name> instead of <inline:1>/<inline:2>/etc. in the standalone distribution's startup Extensions list. Updated packages/cli/sandpiper_resources.test.ts's applyFactories helper to unwrap the union shape. Verified: check:tsc clean, check:biome-check clean, standalone_resource_discovery.test.ts (exercises createSandpiperExtensionFactories through main()) passes. Two unrelated pre-existing test failures confirmed via git stash to predate this change (shell-relay expectations broken by the earlier 'temporarily disable some extensions' commit, df04a14df55c).

---

# Activity Log

## 2026-07-10T15:48:41.315Z

- **depends_on**: (none) → AGENT-224

## 2026-07-10T20:50:07.751Z

- **status**: NOT STARTED → IN PROGRESS
- **assignee**: UNASSIGNED → AGENT

## 2026-07-10T20:52:55.784Z

- **description**: updated

## 2026-07-10T20:52:55.938Z

- **status**: IN PROGRESS → NEEDS REVIEW

## 2026-07-10T20:52:56.172Z

- **status**: NEEDS REVIEW → COMPLETE
- **resolution**: DONE
