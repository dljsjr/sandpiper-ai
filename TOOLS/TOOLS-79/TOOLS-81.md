---
title: "Retain mutation survivor interpretation without bundled-skill prerequisites"
status: COMPLETE
resolution: DONE
kind: SUBTASK
priority: MEDIUM
assignee: AGENT
reporter: USER
created_at: 2026-10-28T20:43:11.310Z
updated_at: 2026-10-28T22:06:43.268Z
---

# Retain mutation survivor interpretation without bundled-skill prerequisites

## Accepted closeout — 2026-10-28

User explicitly requested closing all skill-resource review/extraction tickets. This closes the six-skill inclusion/extraction review only: projects, code-review, refactoring, TDD, mutation-testing and jj. It does not close prompt/theme reviews, deferred SOP redesigns, standalone Trail integration, WIP jj replacement AGENT-67, or updater lifecycle bug TOOLS-87.

Final closeout verification: mutable fixture-array copy resolves TS4104; bun check is clean, full Vitest gate passes 87 files/642 tests with no unhandled errors, and bun run pack:cli passes. Actual tarball has zero built-in skills and no archive/replacement/test-fixture entries. Independent preservation/routing review passed; final artifact/preservation checks are recorded in ~/.sandpiper/agent/backups/jj-unbundle-20261028-3NFgBZ/preservation-after.json.

Mutation-testing original remains unchanged in the incubator (7 files/46,303 bytes). Existing greenfield policy is unchanged.

## Earlier implementation record

## Implementation verified — ready for review

Complete in zxpnrzns / a68124e9: removed retired skill intro/footer and retained only focused survivor interpretation. Meaningful gaps lead to better tests; equivalence requires evidence; exclusions require project-specific justification; score alone does not justify production changes or meaningless tests. Unrelated Key Rules/autonomous TDD, baseline rules, existing-project restrictions and Greenfield policy are byte-identical. No fixed-score/ratchet/CI-schedule/blanket-exclusion rules imported. Markdown and independent review pass.

Verification: full baseline 87 files/640 tests passed. One source-catalogue case baseline GREEN → expected extra-skill RED → archive/resource deletion GREEN. Refactor assessment found no new code structure needing simplification. Updated stale diagnostic contract (2 passing tests), then packed absence assertion demonstrated stale-build RED. Normal rebuild/full gate GREEN: bun check clean, 87 files/640 tests passed, bun run pack:cli passed. Actual tarball contains jj only. No framework installed or generated artifact edited by hand.

Evidence: ~/.sandpiper/agent/backups/mutation-unbundle-20261028-iBKlK2/ contains before.json, archive-verified.json, preservation-after.json and exact deployment/guide/lens backups. Independent read-only mutation-audit (ce39ccc2f023) PASS: archive paths/bytes/modes, prior archives/settings/independent Claude copy unchanged, no archive autoload, no active hard mutation-skill dependencies, guidance scoped, and actual tarball jj-only.

Local revisions: Sandpiper rxxrqtmu / b6cb20e9; canonical global guidance zxpnrzns / a68124e9; Dotfiles snkyrupt / 97537ddb. Muninn single-line user-state patch is not version-controlled; exact backup/preservation proof retained. No push or release.

## Original scope record

Keep developer testing guidance focused on meaningful survivor gaps, demonstrated equivalence and evidence-based interpretation. Do not change production solely to improve mutation score. Remove retired skill prerequisites without copying score thresholds, CI cadence or blanket method exclusions. Leave unrelated testing/greenfield policies unchanged.

---

# Activity Log

## 2026-10-28T20:43:11.587Z

- **status**: NOT STARTED → IN PROGRESS
- **assignee**: UNASSIGNED → AGENT

## 2026-10-28T20:59:21.608Z

- **description**: 1 line → updated (13 lines)

## 2026-10-28T20:59:21.948Z

- **status**: IN PROGRESS → NEEDS REVIEW

## 2026-10-28T22:06:42.057Z

- **description**: 13 lines → updated (23 lines)

## 2026-10-28T22:06:43.269Z

- **status**: NEEDS REVIEW → COMPLETE
- **resolution**: DONE
