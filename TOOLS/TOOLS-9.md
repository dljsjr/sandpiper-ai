---
title: "Investigate upstream pi support for piConfig env var overrides"
status: NOT STARTED
kind: TASK
priority: LOW
assignee: UNASSIGNED
reporter: AGENT
created_at: 2026-03-25T03:03:06.093Z
updated_at: 2026-08-06T20:43:09.864Z
---

# Investigate upstream pi support for piConfig env var overrides

During the deep dive on pi's config.js, we identified that adding PI_APP_NAME and PI_CONFIG_DIR_NAME env var overrides to config.js would eliminate the entire PI_PACKAGE_DIR + symlink dance. A 2-line upstream change. Low priority since the current approach works, but worth proposing if we build a relationship with the pi maintainer.

VERIFIED 2026-08-06 at pi v0.84.0: still no upstream support. config.ts is mechanically unchanged (module-load-time read of package.json piConfig at getPackageDir(); APP_NAME/CONFIG_DIR_NAME derivation identical; only ENV_AGENT_DIR/ENV_SESSION_DIR are APP_NAME-derived). MainOptions is still { extensionFactories } only - no programmatic rebrand hook was added. Proposal remains valid. Companion upstream ask: AGENT-245 (derive bash session env prefix PI_SESSION_ID etc. from APP_NAME, added in pi 0.82.0 as hardcoded literals).

---

# Activity Log

## 2026-03-25T03:03:15.915Z

- **description**: added (1 line)

## 2026-08-06T20:43:09.865Z

- **description**: 1 line → updated (3 lines)
