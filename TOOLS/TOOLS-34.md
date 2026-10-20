---
title: "Make the Sandpiper CLI portable and npm-packable"
status: COMPLETE
resolution: DONE
kind: TASK
priority: MEDIUM
assignee: AGENT
reporter: USER
created_at: 2026-10-20T19:19:36.669Z
updated_at: 2026-10-28T01:17:04.755Z
related:
  - TOOLS-30
---

# Make the Sandpiper CLI portable and npm-packable

Implement the approved portable CLI package: stage built-in skills, prompts, themes, helper executables, and Sandpiper docs beside the built runtime; replace the generated Pi sidecar with a small local patch separating Sandpiper metadata from Pi assets; include patched Pi through bundledDependencies when packing. Preserve source development and configuration behavior. Verify the actual tarball outside the checkout with isolated state and no install scripts or network. Do not publish to a registry.

## Bookkeeping acceptance — 2026-10-27

Accepted portable CLI packaging and Pi asset-root separation. Current packed-install regression verifies offline installation with scripts disabled, read-only execution outside the checkout, six retained built-in skills, patched Pi, and no generated metadata sidecar. Later Trail and standup removals intentionally supersede historical helper and skill counts.

Current verification: bun check passed with zero errors/warnings; bun run test rebuilt package output and passed 87 files / 640 tests, including packed-install, cache-restoration and temporary Trail bridge regressions. Closure requested during the return to build/packaging simplification. Original historical verification is retained above.

---

# Activity Log

## 2026-10-20T19:19:49.843Z

- **status**: NOT STARTED → IN PROGRESS
- **assignee**: UNASSIGNED → AGENT

## 2026-10-20T19:39:19.036Z

- **status**: IN PROGRESS → NEEDS REVIEW

## 2026-10-28T01:17:04.693Z

- **description**: 1 line → updated (7 lines)

## 2026-10-28T01:17:04.755Z

- **status**: NEEDS REVIEW → COMPLETE
- **resolution**: DONE
