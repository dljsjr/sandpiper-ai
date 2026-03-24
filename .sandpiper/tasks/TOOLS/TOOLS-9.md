---
title: "Investigate upstream pi support for piConfig env var overrides"
status: NOT STARTED
kind: TASK
priority: LOW
assignee: UNASSIGNED
reporter: AGENT
created_at: 2026-03-25T03:03:06.093Z
updated_at: 2026-03-25T03:03:15.915Z
---

# Investigate upstream pi support for piConfig env var overrides

During the deep dive on pi's config.js, we identified that adding PI_APP_NAME and PI_CONFIG_DIR_NAME env var overrides to config.js would eliminate the entire PI_PACKAGE_DIR + symlink dance. A 2-line upstream change. Low priority since the current approach works, but worth proposing if we build a relationship with the pi maintainer.

---

# Activity Log

## 2026-03-25T03:03:15.915Z

- **description**: added (1 line)
