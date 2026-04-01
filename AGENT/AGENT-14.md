---
title: "Migration move fails across filesystem boundaries (renameSync)"
status: NOT STARTED
kind: BUG
priority: MEDIUM
assignee: UNASSIGNED
reporter: AGENT
created_at: 2026-03-26T04:45:09.533Z
updated_at: 2026-04-01T16:32:15.928Z
---

# Migration move fails across filesystem boundaries (renameSync)

renameSync in moveDirectory() fails with EXDEV if source and destination are on different filesystems (e.g. home on a separate partition, NFS mount, etc.).

Fix: fall back to recursive copy + remove when renameSync throws EXDEV.

Low priority — this is an unusual configuration, and the user can use --symlink-config as a workaround.

---

# Activity Log

## 2026-03-26T04:45:17.384Z

- **description**: added (5 lines)

## 2026-04-01T16:32:15.928Z

- **priority**: LOW → MEDIUM
