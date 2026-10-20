---
title: "Verify source-loaded extension dependency resolution in publish-style installs"
status: COMPLETE
resolution: DONE
kind: TASK
priority: MEDIUM
assignee: UNASSIGNED
reporter: USER
created_at: 2026-03-30T19:31:59.329Z
updated_at: 2026-10-20T01:28:57.784Z
---

# Verify source-loaded extension dependency resolution in publish-style installs

TOOLS-10 normalized extensions to Pi's source-loaded jiti model inside the monorepo, where runtime imports resolve from the hoisted workspace node_modules. We still need to verify the dependency story for publish-style or npm-installed layouts where the workspace tree may differ.

Follow-up work should verify that source-loaded extensions such as web-fetch and shell-relay still resolve their runtime dependencies correctly when sandpiper is installed outside the repo/workspace context, and should document or adjust packaging if that assumption breaks.

This is intentionally backlog work — do not block the current cleanup on it.

Closed 2026-10-19: covered by devtools/npmPackageInstallSmoke.test.ts ('installs globally without lifecycle scripts and runs from an immutable package directory'), which loads the source extensions from an npm global install. It passed on 2026-10-19 with jsdom and better-sqlite3 externalized (AGENT-318), which would fail at startup if dependencies did not resolve in that layout.

---

# Activity Log

## 2026-03-30T19:31:59.372Z

- **description**: added (5 lines)

## 2026-10-20T01:28:55.874Z

- **description**: 5 lines → updated (7 lines)

## 2026-10-20T01:28:57.650Z

- **status**: NOT STARTED → NEEDS REVIEW

## 2026-10-20T01:28:57.789Z

- **status**: NEEDS REVIEW → COMPLETE
- **resolution**: DONE
