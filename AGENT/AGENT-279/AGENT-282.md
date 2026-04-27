---
title: "Lower all memory write tools onto YAAMS apply"
status: COMPLETE
resolution: WONTFIX
kind: SUBTASK
priority: HIGH
assignee: "Doug"
reporter: USER
created_at: 2026-08-12T02:10:06.638Z
updated_at: 2026-08-12T21:47:56.006Z
depends_on:
  - AGENT-281
---

# Lower all memory write tools onto YAAMS apply

Replace createMemoryWriteOperation, MemberWriteOutcome, writeFactArgs, and the client-side live-read plus add/upsert/retire choreography with one-op YAAMS apply envelopes. memory_create, memory_update, memory_append, and memory_retire each map their typed params to one intent op and consume the tagged positional outcome.

This is the point of the whole refactor: it removes three client-side TOCTOU windows that the transaction closes by construction, and preserves tool-level intent — create rejects live keys, update/retire reject absent keys, append rejects scalar cardinality, list update is store-side diff/reconcile. Keep concise agent-facing result text derived from the created/retired ledgers.

CROSS-REPO DEPENDENCY: blocked on YAAMS-93 (~/git/yaams), which gives `apply` an `--ops <json>` argument. Pi's pi.exec gives the child /dev/null on stdin, so until --ops lands the write tools have no way to deliver an envelope. Trail cannot express the link across task directories, hence this paragraph.

Also: update the fake CLI to implement apply atomically, and add tests for atomic failure, scalar vs list behavior, result decoding, and structured rejection routing. Update README and the behavior contract as part of the implementation — delete the "created 2 of 3 member(s) before failing" partial-count claim, because apply cannot leave that state.


---

**MOVED — not abandoned.** Rewritten by hand as **PIEXT-39** in `~/git/yaams` (2026-08-12). pi-yaams work belongs to the PIEXT project, whose charter is exactly this; AGENT covers capabilities not specific to a single tool or extension. pi-yaams is developed out-of-tree today but moves in-tree with yaams, which is why the board lives there. Trail has no cross-repo move, so this closes WONTFIX rather than leaving a tombstone. All content and work state carried over verbatim.

---

# Activity Log

## 2026-08-12T02:10:19.869Z

- **assignee**: UNASSIGNED → Doug

## 2026-08-12T16:28:45.615Z

- **description**: 5 lines → updated (7 lines)

## 2026-08-12T21:47:55.946Z

- **description**: 7 lines → updated (12 lines)

## 2026-08-12T21:47:56.007Z

- **status**: NOT STARTED → COMPLETE
- **resolution**: WONTFIX
