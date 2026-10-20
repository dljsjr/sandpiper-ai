---
title: "Retire jj skill deployment and hard routing without adopting the WIP replacement"
status: COMPLETE
resolution: DONE
kind: SUBTASK
priority: MEDIUM
assignee: AGENT
reporter: USER
created_at: 2026-10-28T21:15:55.551Z
updated_at: 2026-10-28T22:07:27.962Z
---

# Retire jj skill deployment and hard routing without adopting the WIP replacement

## Accepted and verified closeout — 2026-10-28

Owned Claude jj link and provisioner retired with exact backups. Five canonical guidance docs and source/deployed CLAUDE make the installed skill optional, retaining jj-over-git, checkpoint/workspace/commit safety and current CLI documentation/help fallback. No archive autoload, replacement adoption or deferred AGENT-35 policy rewrite.

Final closeout verification: mutable fixture-array copy resolves TS4104; bun check is clean, full Vitest gate passes 87 files/642 tests with no unhandled errors, and bun run pack:cli passes. Actual tarball has zero built-in skills and no archive/replacement/test-fixture entries. Independent preservation/routing review passed; final artifact/preservation checks are recorded in ~/.sandpiper/agent/backups/jj-unbundle-20261028-3NFgBZ/preservation-after.json.

User explicitly requested closing all skill-resource review/extraction tickets. This closes the six-skill inclusion/extraction review only: projects, code-review, refactoring, TDD, mutation-testing and jj. It does not close prompt/theme reviews, deferred SOP redesigns, standalone Trail integration, WIP jj replacement AGENT-67, or updater lifecycle bug TOOLS-87.

Implementation changes: Sandpiper qmkzynrn, canonical guidance klxvrytv, Dotfiles vtwqyzno. Historical failure-limit checkpoints below are superseded by this successful closeout on the user's explicit resumption request.

## Earlier scope and progress record

Retire only the owned Claude symlink/provisioner. Make active global and Claude routes availability-aware, preserving jj-over-git and safe workspace/commit guidance with current CLI docs/help fallback. Leave the deferred AGENT-35 spec and existing JJ rewrite AGENT-67 alone. No new VCS tutorial, archive registration, replacement install or SOP project.

---

# Activity Log

## 2026-10-28T21:15:55.838Z

- **status**: NOT STARTED → IN PROGRESS
- **assignee**: UNASSIGNED → AGENT

## 2026-10-28T22:06:42.905Z

- **description**: 1 line → updated (13 lines)

## 2026-10-28T22:07:27.863Z

- **status**: IN PROGRESS → NEEDS REVIEW

## 2026-10-28T22:07:27.963Z

- **status**: NEEDS REVIEW → COMPLETE
- **resolution**: DONE
