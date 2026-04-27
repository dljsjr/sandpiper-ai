---
title: "Make the split pi-yaams package publishable"
status: COMPLETE
resolution: WONTFIX
kind: SUBTASK
priority: MEDIUM
assignee: "Doug"
reporter: USER
created_at: 2026-08-12T02:10:06.703Z
updated_at: 2026-08-12T21:47:56.126Z
---

# Make the split pi-yaams package publishable

The old package manifest ships only index.ts and README.md, but this refactor introduces runtime imports from datom-model, tools, prompt-strings, and yaams.ts. Make the package file set include the complete runtime module tree without including test or development junk.

Add a distribution-level check using the package manager pack output (and a minimal installed/loadable extension smoke test if practical) so a future module split cannot publish an entry point whose relative imports are absent. This is release correctness, not formatting.


---

**MOVED — not abandoned.** Rewritten by hand as **PIEXT-40** in `~/git/yaams` (2026-08-12). pi-yaams work belongs to the PIEXT project, whose charter is exactly this; AGENT covers capabilities not specific to a single tool or extension. pi-yaams is developed out-of-tree today but moves in-tree with yaams, which is why the board lives there. Trail has no cross-repo move, so this closes WONTFIX rather than leaving a tombstone. All content and work state carried over verbatim.

---

# Activity Log

## 2026-08-12T02:10:19.926Z

- **assignee**: UNASSIGNED → Doug

## 2026-08-12T21:47:56.067Z

- **description**: 3 lines → updated (8 lines)

## 2026-08-12T21:47:56.127Z

- **status**: NOT STARTED → COMPLETE
- **resolution**: WONTFIX
