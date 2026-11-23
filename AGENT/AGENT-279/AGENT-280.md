---
title: "Finish the YAAMS wire codec and recover its tests"
status: COMPLETE
resolution: WONTFIX
kind: SUBTASK
priority: HIGH
assignee: "Doug"
reporter: USER
created_at: 2026-08-12T02:10:06.504Z
updated_at: 2026-11-23T22:02:51.734Z
---

# Finish the YAAMS wire codec and recover its tests

Own the parser layer as the sole untrusted-JSON boundary. Repair the currently failing codec tests based on the YAAMS wire contract, not by preserving stale error strings.

Scope:
- Accept absent provenance, but reject dangling excerpt/path fields; retain file-ref constraints.
- Validate required core field types before constructing branded entity, attribute, timestamp, and fact-type values.
- Decode `search` as its actual `{ fact, score, bm25_score?, vector_score? }` envelope (do not flatten the fact), including the vector-score presence check.
- Add strict decoders for apply success and JSON error envelopes, with tagged op results and integer ledgers.
- Give parseAttribute a call signature that accepts the tool schema union (string or AttributeLike) without a caller cast.

Verification: codec tests cover valid CLI fixtures and malformed roots/fields; `bun test datom-model/codec/codec.test.ts` passes.


---

**MOVED — not abandoned.** Rewritten by hand as **PIEXT-37** in the separate yaams repository (2026-08-12). pi-yaams work belongs to the PIEXT project, whose charter is exactly this; AGENT covers capabilities not specific to a single tool or extension. pi-yaams is developed out-of-tree today but moves in-tree with yaams, which is why the board lives there. Trail has no cross-repo move, so this closes WONTFIX rather than leaving a tombstone. All content and work state carried over verbatim.

---

# Activity Log

## 2026-08-12T02:10:19.754Z

- **assignee**: UNASSIGNED → Doug

## 2026-08-12T21:47:55.690Z

- **description**: 10 lines → updated (15 lines)

## 2026-08-12T21:47:55.762Z

- **status**: NOT STARTED → COMPLETE
- **resolution**: WONTFIX

## 2026-11-23T22:02:51.734Z

- **description**: updated
