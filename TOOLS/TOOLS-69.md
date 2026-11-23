---
title: "Unbundle refactoring and preserve it for a separate SOP rethink"
status: COMPLETE
resolution: DONE
kind: TASK
priority: MEDIUM
assignee: AGENT
reporter: USER
created_at: 2026-10-28T18:29:07.329Z
updated_at: 2026-11-23T22:02:55.796Z
related:
  - TOOLS-57
  - TOOLS-30
---

# Unbundle refactoring and preserve it for a separate SOP rethink

User approved the same treatment as code-review during the one-by-one review: preserve the complete current refactoring skill unchanged in the separate skills-incubator repository, remove its Sandpiper-owned bundled copy, and defer the SOP rethink. Preserve every source file/byte/mode; do not overwrite an existing destination. Update source/system-prompt/packed catalogue expectations and active mandatory skill dependencies only. Remove retired Sandpiper-linked deployment/provisioning if present, but preserve independent installed copies and unrelated state. Retained-skill/prompt edits must be limited to optional dependency routing, not a new SOP or content rewrite. No archive auto-loading, new package/repo, or decisions about jj/mutation-testing/test-driven-development. Verification belongs to the parent; final completion awaits user acceptance.

## Ready for user review — 2026-10-28

All scoped work is implemented. Exact archive: the refactoring skill in the separate skills-incubator repository (11 files, 2 directories, all bytes/paths/modes preserved). Source and tarball copies are removed; obsolete Claude link/provisioner backed up and retired; only active dependency routing changed. Independent preservation, routing and no-autoload review PASS. Prior code-review archive/global settings unchanged.

Source revisions: Sandpiper kylsozsk/b9943057; global guidance zttqxmyr/1d075a7b; dotfiles uywuuwsy/694e5324. All three source checkouts clean. Four focused tests first failed on skill presence; final bun check zero errors/warnings, bun run test 87files/640tests, pack:cli, actual three-skill tarball inspection, scoped Prettier checks, and source/staged/packed TDD equality all pass.

TOOLS-69/70/71/72 await user review, not final-completed. Refactoring SOP rethink TOOLS-73 and code-review SOP redesign TOOLS-68 remain NOT STARTED. The remaining three skill decisions, prompt/theme reviews and broader build work are not closed by this slice.

## User acceptance — 2026-10-28

The user accepted refactoring archival/unbundling and directed the discussion to the next skill. Final-complete only this implementation and its three children. The deferred SOP rethink and remaining skill decisions stay open.

---

# Activity Log

## 2026-10-28T18:29:07.439Z

- **status**: NOT STARTED → IN PROGRESS
- **assignee**: UNASSIGNED → AGENT

## 2026-10-28T18:38:19.662Z

- **description**: 1 line → updated (9 lines)

## 2026-10-28T18:38:19.723Z

- **status**: IN PROGRESS → NEEDS REVIEW

## 2026-10-28T18:49:23.606Z

- **description**: 9 lines → updated (13 lines)

## 2026-10-28T18:49:23.868Z

- **status**: NEEDS REVIEW → COMPLETE
- **resolution**: DONE

## 2026-11-23T22:02:55.796Z

- **description**: updated
