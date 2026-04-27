---
title: "Replace tattler-inbox.ts modelVisible content hack with entry renderers"
status: COMPLETE
resolution: DONE
kind: SUBTASK
priority: MEDIUM
assignee: UNASSIGNED
reporter: USER
created_at: 2026-07-10T15:48:36.843Z
depends_on:
  - AGENT-224
updated_at: 2026-08-06T23:24:30.218Z
---

# Replace tattler-inbox.ts modelVisible content hack with entry renderers

extensions/tattler/tattler-inbox.ts:206 fakes 'do not show this to the model' by setting content: '' on a real custom message (still nominally context-participating and counted in compaction budgeting). Replace with pi.appendEntry() + pi.registerEntryRenderer() (added in Pi 0.80.4) for true display-only, non-context entries. Touches extensions/chorus/chorus-ui.ts (sendChorusMessageToChat) and extensions/chorus.ts call sites (modelVisible: false paths) as well. Depends on the 0.80.6 version bump subtask.

---

# Activity Log

## 2026-07-10T15:48:41.121Z

- **depends_on**: (none) → AGENT-224

## 2026-08-06T20:42:25.987Z

- **parent**: AGENT-223 → AGENT-235

## 2026-08-06T23:24:30.152Z

- **status**: NOT STARTED → NEEDS REVIEW

## 2026-08-06T23:24:30.219Z

- **status**: NEEDS REVIEW → COMPLETE
- **resolution**: DONE
