---
title: "Preserve the bundled jj skill unchanged in the incubator"
status: COMPLETE
resolution: DONE
kind: SUBTASK
priority: MEDIUM
assignee: AGENT
reporter: USER
created_at: 2026-10-28T21:15:55.382Z
updated_at: 2026-10-28T22:07:27.421Z
---

# Preserve the bundled jj skill unchanged in the incubator

## Accepted and verified closeout — 2026-10-28

Complete original jj copy preserved unchanged at ~/git/skills-incubator/skills/jj. Independent and final snapshots match all paths/bytes/modes; four prior archives, global settings, independent Claude copy and WIP replacement skills remain unchanged.

Final closeout verification: mutable fixture-array copy resolves TS4104; bun check is clean, full Vitest gate passes 87 files/642 tests with no unhandled errors, and bun run pack:cli passes. Actual tarball has zero built-in skills and no archive/replacement/test-fixture entries. Independent preservation/routing review passed; final artifact/preservation checks are recorded in ~/.sandpiper/agent/backups/jj-unbundle-20261028-3NFgBZ/preservation-after.json.

User explicitly requested closing all skill-resource review/extraction tickets. This closes the six-skill inclusion/extraction review only: projects, code-review, refactoring, TDD, mutation-testing and jj. It does not close prompt/theme reviews, deferred SOP redesigns, standalone Trail integration, WIP jj replacement AGENT-67, or updater lifecycle bug TOOLS-87.

Implementation changes: Sandpiper qmkzynrn, canonical guidance klxvrytv, Dotfiles vtwqyzno. Historical failure-limit checkpoints below are superseded by this successful closeout on the user's explicit resumption request.

## Earlier scope and progress record

No existing incubator jj copy was found. Archive all 16 files/188,007 bytes with exact paths and modes before removing source. Preserve prior archives, independent copies and the WIP jujustu-vcs-skill replacement untouched. No installation or archive auto-loading.

---

# Activity Log

## 2026-10-28T21:15:55.706Z

- **status**: NOT STARTED → IN PROGRESS
- **assignee**: UNASSIGNED → AGENT

## 2026-10-28T22:06:42.580Z

- **description**: 1 line → updated (13 lines)

## 2026-10-28T22:07:27.320Z

- **status**: IN PROGRESS → NEEDS REVIEW

## 2026-10-28T22:07:27.421Z

- **status**: NEEDS REVIEW → COMPLETE
- **resolution**: DONE
