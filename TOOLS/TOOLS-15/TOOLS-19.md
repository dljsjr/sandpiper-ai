---
title: "Remove install lifecycle hooks from source and package manifests"
status: COMPLETE
resolution: DONE
kind: SUBTASK
priority: HIGH
assignee: UNASSIGNED
reporter: USER
created_at: 2026-05-08T21:36:25.735Z
depends_on:
  - TOOLS-18
  - TOOLS-20
updated_at: 2026-05-08T22:31:30.763Z
---

# Remove install lifecycle hooks from source and package manifests

Make dependency installation independent from Sandpiper artifact generation.

Remove or replace:
- root `preinstall` and `postinstall` scripts,
- package-level `preinstall` build scripts,
- docs and CLI messages that imply `bun install` builds Sandpiper artifacts.

Target behavior:
- `bun install` installs dependencies only.
- Developers explicitly run `bun run build:packages` or `bun run prepare:distribution` when artifacts are needed.
- Published npm artifacts require no install-time build, vendoring, download, or package mutation.

---

# Activity Log

## 2026-05-08T21:36:25.786Z

- **description**: added (11 lines)

## 2026-05-08T21:36:36.867Z

- **depends_on**: (none) → TOOLS-18, TOOLS-20

## 2026-05-08T22:31:30.766Z

- **status**: NOT STARTED → COMPLETE
- **resolution**: DONE
