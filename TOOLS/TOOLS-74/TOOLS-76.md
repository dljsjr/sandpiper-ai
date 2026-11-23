---
title: "Preserve autonomous one-test red-green-refactor in developer guidance"
status: COMPLETE
resolution: DONE
kind: SUBTASK
priority: MEDIUM
assignee: AGENT
reporter: USER
created_at: 2026-10-28T18:57:43.569Z
updated_at: 2026-11-23T22:02:45.051Z
---

# Preserve autonomous one-test red-green-refactor in developer guidance

## Implementation verified — ready for review

Complete in canonical global-guidance revision zzuwsomr / 65a3a2ef: developer ROLE.md and testing.md explicitly preserve autonomous one-test RED → GREEN → REFACTOR, expected-failure verification, minimum GREEN, refactor assessment before the next test, and no batching. Removed retired TDD skill prerequisites. Existing requirement to ask before changing testing infrastructure is unchanged; it is not a routine per-test approval gate. Markdown formatting and independent review pass.

Verification: bun check clean; 87 Vitest files / 640 tests passed; bun run pack:cli passed, including isolated packed-install checks. Actual tarball contains only jj and mutation-testing skill directories. Independent preservation/routing review passed.

Local revisions: Sandpiper poqzxkxz / 5a0d94c7; canonical global guidance zzuwsomr / 65a3a2ef; Dotfiles vzsmtonk / a721a4f0. All edits are scoped; no remote push or release.

## Earlier scope record

Keep the developer-role rule explicit and autonomous: one behavior -> one test -> run and verify RED for the expected missing behavior -> minimum GREEN -> refactor -> repeat. No batch tests/bulk implementation and no user approval checkpoint for each test. Preserve the refactor phase without forcing unnecessary changes. Keep existing test-first/observable-behavior/BDD guidance rather than copying the tutorial wholesale. The earlier human-confirmation interpretation was explicitly corrected by the user; do not restore it from the old archive. No broad testing/refactoring SOP redesign.

---

# Activity Log

## 2026-10-28T19:31:43.493Z

- **title**: Preserve the per-behavior TDD confirmation checkpoint in developer guidance → Preserve autonomous one-test red-green-refactor in developer guidance

## 2026-10-28T19:31:43.686Z

- **description**: updated

## 2026-10-28T19:35:45.302Z

- **status**: NOT STARTED → IN PROGRESS
- **assignee**: UNASSIGNED → AGENT

## 2026-10-28T20:11:31.637Z

- **description**: 1 line → updated (11 lines)

## 2026-10-28T20:11:32.236Z

- **status**: IN PROGRESS → NEEDS REVIEW

## 2026-10-28T20:32:15.069Z

- **status**: NEEDS REVIEW → COMPLETE
- **resolution**: DONE

## 2026-11-23T22:02:45.051Z

- **description**: updated
