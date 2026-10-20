---
title: "Pi's update banner tells Sandpiper users to run 'sandpiper update', which installs stock Pi"
status: COMPLETE
resolution: WONTFIX
kind: BUG
priority: MEDIUM
assignee: UNASSIGNED
reporter: AGENT
created_at: 2026-11-17T21:04:27.053Z
updated_at: 2026-11-19T19:14:13.671Z
---

# Pi's update banner tells Sandpiper users to run 'sandpiper update', which installs stock Pi

Pi's native update notice says 'Run sandpiper update'. From a global install that command would install stock Pi beside Sandpiper. Mentioned in AGENT-319's notes and the Pi 1.5 update audit (archived under AGENT-332); no task tracks it.

## Closed in backlog triage (2026-11-19)

Doug wants the banner: it tells him when there is a Pi release to check and build against. From a checkout, `sandpiper update` refuses and names the package to update (AGENT-319), so the wording is harmless in his setup. A patch that drops the "Run sandpiper update" text was offered and declined.

---

# Activity Log

## 2026-11-19T19:14:13.574Z

- **description**: 1 line → updated (5 lines)

## 2026-11-19T19:14:13.671Z

- **status**: NOT STARTED → COMPLETE
- **resolution**: UNRESOLVED → WONTFIX
