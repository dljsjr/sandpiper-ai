---
title: "Add broker-owned participant snapshot to Chorus room posts"
status: NOT STARTED
kind: SUBTASK
priority: MEDIUM
assignee: "Huginn"
reporter: USER
created_at: 2026-05-25T19:12:00.551Z
depends_on:
  - TAT-58
updated_at: 2026-05-25T19:17:28.541Z
---

# Add broker-owned participant snapshot to Chorus room posts

Have the Chorus broker stamp canonical room posts with a best-effort participant/audience snapshot before fanout and local injection. Include display names at minimum; avoid asking agents/tools to populate this. Treat it as a snapshot at fanout time, not stable membership/read-receipt state.

---

# Activity Log

## 2026-05-25T19:12:56.850Z

- **assignee**: UNASSIGNED → Huginn

## 2026-05-25T19:17:28.542Z

- **depends_on**: (none) → TAT-58
