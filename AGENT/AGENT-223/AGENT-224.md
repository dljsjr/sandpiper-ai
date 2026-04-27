---
title: "Bump pinned pi-coding-agent to 0.80.6 across the monorepo"
status: COMPLETE
resolution: DONE
kind: SUBTASK
priority: MEDIUM
assignee: UNASSIGNED
reporter: USER
created_at: 2026-07-10T15:48:36.578Z
updated_at: 2026-07-10T16:49:37.476Z
---

# Bump pinned pi-coding-agent to 0.80.6 across the monorepo

Update the exact-pin '@earendil-works/pi-coding-agent' version (currently 0.80.3) in every package.json that declares it: root package.json, packages/cli/package.json, plugins/pi/extensions/package.json, extensions/{shell-relay,autotoon,web-fetch,system,web-search}/package.json, and dist/ generated equivalents. Verify with bun run check:deps, bun check, bun run test, and rm -rf dist && env -u PI_PACKAGE_DIR bun run test:distribution.

---

# Activity Log

## 2026-07-10T16:49:37.328Z

- **status**: NOT STARTED → NEEDS REVIEW

## 2026-07-10T16:49:37.477Z

- **status**: NEEDS REVIEW → COMPLETE
- **resolution**: DONE
