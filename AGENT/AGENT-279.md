---
title: "Complete pi-yaams parser refactor and migrate the YAAMS adapter"
status: COMPLETE
resolution: WONTFIX
kind: TASK
priority: HIGH
assignee: "Doug"
reporter: USER
created_at: 2026-08-12T02:09:26.336Z
updated_at: 2026-11-23T22:02:46.322Z
---

# Complete pi-yaams parser refactor and migrate the YAAMS adapter

Finish the in-flight parser refactor as a real wire boundary, then move the adapter from legacy add/upsert/retire choreography to YAAMS apply.

The working copy introduces datom-model/codec and split tools, but the suite is red: `bun run check` reports 10 errors and `bun test` has 9 failures plus an import-time error (verified 2026-08-11).

Success: every YAAMS CLI response is decoded from unknown at the transport boundary; read tools and bootstrap consume typed facts/search results; the four write tools submit one apply envelope each and preserve their agent-facing intent; no legacy client-side read/retire/write choreography remains; package output includes the new module tree; `bun run check` and `bun test` pass.

YAAMS CLI apply reads JSON from stdin and emits tagged, positionally aligned JSON results; JSON failures are structured on stderr.


---

**MOVED — not abandoned.** Rewritten by hand as **PIEXT-36** in the separate yaams repository (2026-08-12). pi-yaams work belongs to the PIEXT project, whose charter is exactly this; AGENT covers capabilities not specific to a single tool or extension. pi-yaams is developed out-of-tree today but moves in-tree with yaams, which is why the board lives there. Trail has no cross-repo move, so this closes WONTFIX rather than leaving a tombstone. All content and work state carried over verbatim.

---

# Activity Log

## 2026-08-12T02:10:19.694Z

- **status**: NOT STARTED → IN PROGRESS
- **assignee**: UNASSIGNED → Doug

## 2026-08-12T21:47:56.188Z

- **description**: 7 lines → updated (12 lines)

## 2026-08-12T21:47:56.248Z

- **status**: IN PROGRESS → COMPLETE
- **resolution**: WONTFIX

## 2026-11-23T22:02:46.322Z

- **description**: updated
