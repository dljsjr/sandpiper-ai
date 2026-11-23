---
title: "Bump pi pins to 0.84.0 across the monorepo"
status: COMPLETE
resolution: DONE
kind: SUBTASK
priority: HIGH
assignee: "sandpiper-0.84-dev"
reporter: AGENT
created_at: 2026-08-06T20:41:41.362Z
depends_on:
  - AGENT-246
updated_at: 2026-11-23T22:02:34.919Z
---

# Bump pi pins to 0.84.0 across the monorepo

Pins: root package.json:81-82 (pi-coding-agent, pi-tui), extensions/{autotoon,shell-relay,system,web-fetch,web-search}/package.json, plugins/pi/extensions/package.json (pi-coding-agent, pi-ai, pi-tui). Depends on AGENT-246 (typebox -> pi-ai re-export migration) landing first: once it does, there is NO typebox pin left to manage. Contingency: if AGENT-246 is deferred for any reason, the direct typebox pin must be bumped 1.3.6 -> 1.3.7 in the same change as the pi pins (the alias Pi bundles as of 0.83.0; we use no removed APIs; 1.3.7 fixes compiled validation of nullable array tool args).

Gate: bun check clean, bun run test, then rm -rf dist && env -u PI_PACKAGE_DIR bun run test:distribution.

PRECONDITION (added 2026-08-06): the full test suite must be deterministically green BEFORE this bump lands. Discovered during AGENT-246/247: baseline (bee0e075) fails 23 tests across 8 files - packages/trail x3 (git commit hits the user's real SSH-signing config / 1Password agent: a test-isolation gap violating the tests-never-touch-real-user-state rule; fix by neutralizing git config in test env), devtools/ecosystemPackage + npmPackageInstallSmoke (caret-range deps under dist/examples - likely VENDORED Pi example manifests tripping our exactness invariants, since no tracked source carries carets; needs investigation, may be an invariant-scope decision), extensions/system/extension-factories.test.ts (extra session_shutdown event), packages/core system-prompt.test.ts (skillsBlock mismatch), plus parallel-load timeout flakes in standalone tests (pass in isolation). Root causes must be reported to the coordinator before fixes for the four non-mechanical ones - some may be upstream-content interactions or intentional in-progress state rather than bugs. Rationale: the pin bump is the riskiest change in the tree; landing it on a red suite makes bump-regressions indistinguishable from pre-existing failures.

PRECONDITION SATISFIED (2026-08-06): full suite reviewer-verified green after stale .turbo cache purge - 1049/1049 vitest, 63/63 distribution, independently reproduced by sandpiper-0.84-rev on anchor xulrqywv/b2bbf3e79455. Bump verification MUST start from a purged .turbo (see AGENT-237 step f).

---

# Activity Log

## 2026-08-06T20:58:27.888Z

- **status**: NOT STARTED → IN PROGRESS
- **assignee**: UNASSIGNED → sandpiper-0.84-dev

## 2026-08-06T21:00:32.111Z

- **title**: Bump pi pins to 0.84.0 and typebox to 1.3.7 across the monorepo → Bump pi pins to 0.84.0 across the monorepo
- **description**: updated
- **depends_on**: (none) → AGENT-246

## 2026-08-06T21:17:32.849Z

- **description**: 3 lines → updated (5 lines)

## 2026-08-06T22:23:42.598Z

- **description**: 5 lines → updated (7 lines)

## 2026-08-06T22:31:02.004Z

- **status**: IN PROGRESS → NEEDS REVIEW

## 2026-08-06T22:31:02.064Z

- **status**: NEEDS REVIEW → COMPLETE
- **resolution**: DONE

## 2026-11-23T22:02:34.919Z

- **description**: updated
