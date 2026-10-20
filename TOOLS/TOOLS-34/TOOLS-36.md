---
title: "Stage built-in resources and pack the patched runtime dependency"
status: COMPLETE
resolution: DONE
kind: SUBTASK
priority: MEDIUM
assignee: AGENT
reporter: AGENT
created_at: 2026-10-20T19:19:50.031Z
updated_at: 2026-10-28T01:17:04.501Z
---

# Stage built-in resources and pack the patched runtime dependency

Implemented package-owned resource staging, helper build prerequisites, docs staging and cleanup, and CLI manifest bundledDependencies. CLI now declares all direct external runtime dependencies. Added devtools/packCli.ts and bun run pack:cli. Both Bun and npm pack omit hoisted workspace dependencies when invoked directly in packages/cli, so the pack wrapper stages publishable files in a temporary directory, exposes the root dependency tree there, runs bun pm pack, and removes the temporary directory. This packages already-patched Pi without a fork, install hooks, or runtime sidecars. Output: packages/cli/dist/sandpiper-ai-cli-0.0.1.tgz (about 38 MB).

## Bookkeeping acceptance — 2026-10-27

Accepted portable CLI packaging and Pi asset-root separation. Current packed-install regression verifies offline installation with scripts disabled, read-only execution outside the checkout, six retained built-in skills, patched Pi, and no generated metadata sidecar. Later Trail and standup removals intentionally supersede historical helper and skill counts.

Current verification: bun check passed with zero errors/warnings; bun run test rebuilt package output and passed 87 files / 640 tests, including packed-install, cache-restoration and temporary Trail bridge regressions. Closure requested during the return to build/packaging simplification. Original historical verification is retained above.

---

# Activity Log

## 2026-10-20T19:26:11.700Z

- **status**: NOT STARTED → IN PROGRESS
- **assignee**: UNASSIGNED → AGENT

## 2026-10-20T19:30:57.285Z

- **status**: IN PROGRESS → NEEDS REVIEW

## 2026-10-20T19:39:18.834Z

- **description**: added (1 line)

## 2026-10-28T01:17:04.434Z

- **description**: 1 line → updated (7 lines)

## 2026-10-28T01:17:04.502Z

- **status**: NEEDS REVIEW → COMPLETE
- **resolution**: DONE
