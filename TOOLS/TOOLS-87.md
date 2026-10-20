---
title: "Scope asynchronous update banners to a live extension session"
status: COMPLETE
resolution: DONE
kind: BUG
priority: MEDIUM
assignee: UNASSIGNED
reporter: AGENT
created_at: 2026-10-28T21:46:48.339Z
updated_at: 2026-11-10T22:20:49.371Z
related:
  - TOOLS-83
  - TOOLS-85
---

# Scope asynchronous update banners to a live extension session

## Closed with the code it was in (2026-11-10)

Doug decided to replace Sandpiper's own update check with Pi's native check (AGENT-319, change oqutxtqn). That change deletes the session_start update callback in extensions/system/diagnostics-hooks.ts, which is where this defect lived. No stale-handle append remains, so there is nothing left to fix.

Observed during TOOLS-83 final verification: all 642 assertions passed, but Vitest reported an unhandled rejection from extensions/system/diagnostics-hooks.ts:68–70. A session_start checkForUpdates().then(...) callback retained pi and called appendEntry after the resource-discovery test disposed/replaced its session; Pi 1.3 correctly rejects this stale extension context. This is local Sandpiper lifecycle behavior, not an upstream bug. Reproduce with a controlled deferred update result after disposal/reload/session replacement; avoid appending through stale handles and avoid merely swallowing lifecycle errors. Production fix is outside the extraction slice and remains NOT STARTED. The resource-discovery test will use existing neutral capability factories, because identity/update work is unrelated to the resource catalogue and should not run in this fixture.

---

# Activity Log

## 2026-11-10T22:20:41.233Z

- **description**: 1 line → updated (5 lines)

## 2026-11-10T22:20:49.309Z

- **status**: NOT STARTED → NEEDS REVIEW

## 2026-11-10T22:20:49.372Z

- **status**: NEEDS REVIEW → COMPLETE
- **resolution**: DONE
