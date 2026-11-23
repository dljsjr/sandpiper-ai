---
title: "Retire mutation skill routing and deployment"
status: COMPLETE
resolution: DONE
kind: SUBTASK
priority: MEDIUM
assignee: AGENT
reporter: USER
created_at: 2026-10-28T20:43:11.387Z
updated_at: 2026-11-23T22:02:56.393Z
---

# Retire mutation skill routing and deployment

## Accepted closeout — 2026-10-28

User explicitly requested closing all skill-resource review/extraction tickets. This closes the six-skill inclusion/extraction review only: projects, code-review, refactoring, TDD, mutation-testing and jj. It does not close prompt/theme reviews, deferred SOP redesigns, standalone Trail integration, WIP jj replacement AGENT-67, or updater lifecycle bug TOOLS-87.

Final closeout verification: mutable fixture-array copy resolves TS4104; bun check is clean, full Vitest gate passes 87 files/642 tests with no unhandled errors, and bun run pack:cli passes. Actual tarball has zero built-in skills and no archive/replacement/test-fixture entries. Independent preservation/routing review passed; final artifact/preservation checks were recorded.

Mutation-testing original remains unchanged in the incubator (7 files/46,303 bytes). Existing greenfield policy is unchanged.

## Earlier implementation record

## Implementation verified — ready for review

Complete: both catalogue READMEs and three existing contracts now expect jj-only built-ins. Planned Stryker spec uses generic methodology/tool docs; its plan remains otherwise unchanged. Backed up/retired only the owned Claude symlink and Dotfiles template. Muninn direct coordination found no live peer; scoped notice preceded the exact one-line load-route patch. Independent full diff confirms no other lens byte/mode changes. Existing conditional installed-skill references are intentionally optional, not archive registration. No SELF/IDENTITY/MEMORY edits or owner consent claimed.

Verification: full baseline 87 files/640 tests passed. One source-catalogue case baseline GREEN → expected extra-skill RED → archive/resource deletion GREEN. Refactor assessment found no new code structure needing simplification. Updated stale diagnostic contract (2 passing tests), then packed absence assertion demonstrated stale-build RED. Normal rebuild/full gate GREEN: bun check clean, 87 files/640 tests passed, bun run pack:cli passed. Actual tarball contains jj only. No framework installed or generated artifact edited by hand.

Independent read-only mutation-audit (ce39ccc2f023) PASS: archive paths/bytes/modes, prior archives/settings/independent Claude copy unchanged, no archive autoload, no active hard mutation-skill dependencies, guidance scoped, and actual tarball jj-only.

Local revisions: Sandpiper rxxrqtmu / b6cb20e9; canonical global guidance zxpnrzns / a68124e9; Dotfiles snkyrupt / 97537ddb. Muninn single-line user-state patch is not version-controlled; exact backup/preservation proof retained. No push or release.

## Original scope record

Update catalogue docs and existing regression contracts, retire the owned Claude symlink/provisioner, and correct active hard dependency routes. Preserve independent installed copies and identity lens content; coordinate and back up any private routing-only change. Verify packed discovery and archive preservation.

---

# Activity Log

## 2026-10-28T20:43:11.649Z

- **status**: NOT STARTED → IN PROGRESS
- **assignee**: UNASSIGNED → AGENT

## 2026-10-28T20:59:21.716Z

- **description**: 1 line → updated (13 lines)

## 2026-10-28T20:59:22.009Z

- **status**: IN PROGRESS → NEEDS REVIEW

## 2026-10-28T22:06:42.237Z

- **description**: 13 lines → updated (23 lines)

## 2026-10-28T22:06:43.368Z

- **status**: NEEDS REVIEW → COMPLETE
- **resolution**: DONE

## 2026-11-23T22:02:56.393Z

- **description**: updated
