---
title: "Verify the installed tarball and update portability documentation"
status: COMPLETE
resolution: DONE
kind: SUBTASK
priority: MEDIUM
assignee: AGENT
reporter: AGENT
created_at: 2026-10-20T19:19:50.161Z
updated_at: 2026-10-28T01:17:04.629Z
---

# Verify the installed tarball and update portability documentation

Verified bun check with zero errors/warnings; bun run test with 128 files and 1,227 passing tests; bun run pack:cli; source helper restoration after deleting all three generated helper copies and rebuilding with cached prerequisites. Packed-install regression installs offline with an empty npm cache and scripts disabled, marks the installation read-only, and runs sandpiper --version/--help, sandpiper-system-prompt, and all three helper entrypoints outside the checkout. It asserts exact eight-skill auto-discovery, package-local paths, both Pi patches, shipped assets/docs, and no metadata sidecar. Updated public build docs, CLI/resource READMEs, and development playbook. Verified on macOS arm64 with Bun 1.4.3 and npm 11.19.1. No registry publication.

## Bookkeeping acceptance — 2026-10-27

Accepted portable CLI packaging and Pi asset-root separation. Current packed-install regression verifies offline installation with scripts disabled, read-only execution outside the checkout, six retained built-in skills, patched Pi, and no generated metadata sidecar. Later Trail and standup removals intentionally supersede historical helper and skill counts.

Current verification: bun check passed with zero errors/warnings; bun run test rebuilt package output and passed 87 files / 640 tests, including packed-install, cache-restoration and temporary Trail bridge regressions. Closure requested during the return to build/packaging simplification. Original historical verification is retained above.

---

# Activity Log

## 2026-10-20T19:30:57.363Z

- **status**: NOT STARTED → IN PROGRESS
- **assignee**: UNASSIGNED → AGENT

## 2026-10-20T19:39:18.904Z

- **description**: added (1 line)

## 2026-10-20T19:39:18.970Z

- **status**: IN PROGRESS → NEEDS REVIEW

## 2026-10-28T01:17:04.567Z

- **description**: 1 line → updated (7 lines)

## 2026-10-28T01:17:04.630Z

- **status**: NEEDS REVIEW → COMPLETE
- **resolution**: DONE
