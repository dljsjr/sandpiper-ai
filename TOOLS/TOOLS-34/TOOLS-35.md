---
title: "Patch Pi asset resolution and remove the generated sidecar"
status: COMPLETE
resolution: DONE
kind: SUBTASK
priority: MEDIUM
assignee: AGENT
reporter: AGENT
created_at: 2026-10-20T19:19:49.918Z
updated_at: 2026-10-28T01:17:04.370Z
---

# Patch Pi asset resolution and remove the generated sidecar

Implemented the Pi 1.3.0 asset-root patch in the existing Bun patch file, preserving the system-prompt patch. Product metadata uses the real sandpiper-ai-cli package; Pi themes, interactive assets, and HTML export templates use PI_CODING_AGENT_PACKAGE. Removed generated sidecar preparation and startup filesystem writes. Built paths resolve package-owned staged resources without a repository root or silent checkout fallback. Source mode and explicit metadata/resource overrides remain supported. Test-first verification covers separate runtime/product roots, source assets, stock-Pi fallback, installed package resolution, and missing resources.

## Bookkeeping acceptance — 2026-10-27

Accepted portable CLI packaging and Pi asset-root separation. Current packed-install regression verifies offline installation with scripts disabled, read-only execution outside the checkout, six retained built-in skills, patched Pi, and no generated metadata sidecar. Later Trail and standup removals intentionally supersede historical helper and skill counts.

Current verification: bun check passed with zero errors/warnings; bun run test rebuilt package output and passed 87 files / 640 tests, including packed-install, cache-restoration and temporary Trail bridge regressions. Closure requested during the return to build/packaging simplification. Original historical verification is retained above.

---

# Activity Log

## 2026-10-20T19:20:44.485Z

- **status**: NOT STARTED → IN PROGRESS
- **assignee**: UNASSIGNED → AGENT

## 2026-10-20T19:30:57.213Z

- **status**: IN PROGRESS → NEEDS REVIEW

## 2026-10-20T19:39:18.756Z

- **description**: added (1 line)

## 2026-10-28T01:17:04.302Z

- **description**: 1 line → updated (7 lines)

## 2026-10-28T01:17:04.370Z

- **status**: NEEDS REVIEW → COMPLETE
- **resolution**: DONE
