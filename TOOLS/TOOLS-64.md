---
title: "Unbundle code-review and preserve it for an independent SOP redesign"
status: COMPLETE
resolution: DONE
kind: TASK
priority: MEDIUM
assignee: AGENT
reporter: USER
created_at: 2026-10-28T17:55:43.501Z
updated_at: 2026-10-28T18:22:55.458Z
related:
  - TOOLS-57
  - TOOLS-30
---

# Unbundle code-review and preserve it for an independent SOP redesign

User approved removing the bundled code-review skill and preserving its full current directory under ~/git/skills-incubator for a separate drastic SOP rethink. Use the established skills/code-review directory layout; preserve all files/bytes/modes and do not overwrite an existing destination. Remove only the Sandpiper-owned bundled copy, update discovery/packaging contracts and active mandatory routing, and verify both source and packed catalogues. Do not rewrite the archived skill, auto-load it, redesign prompts, decide the other four remaining skills, or modify independent user-installed copies. Any retained prompt changes must be limited to removing the deleted-skill prerequisite. Track the SOP design separately; completion of that design is not required for this unbundling.

## Ready for user review — 2026-10-28

Archived unchanged: ~/git/skills-incubator/skills/code-review (11 files); no archive auto-loading. Removed bundled copy from source and actual tarball. Preserved independent Claude installation and all global settings. Only known global role references and three retained-prompt routing sentences changed; no SOP or prompt procedure redesign occurred. Independent preservation and active-routing review PASS. Evidence: /Users/dstephen/.sandpiper/agent/backups/code-review-unbundle-20261028-Jyz225/{before.json,archive-verified.json,preservation-after.json}.

Source revisions: Sandpiper lqwxrkwp/83679fb9; canonical global guidance ptvmqonr/6652aa63. Both checkouts clean. Verification: four relevant tests failed first on old skill presence; final bun check clean, 87 files/640 tests, pack:cli, tarball exactly four remaining skills/no code-review, and Prettier checks. Generic staging fixture/retained prompt names and the completed AGENT-35 design example remain intentionally.

Tracker finding: a combined related-fields/description update was rejected with a non-round-trippable updated_at error. A quote-only experiment did not help and was completely reverted; byte comparison verified the original task before a plain CLI completion succeeded. No raw timestamp-format change remains and no Trail implementation was changed.

TOOLS-64 and children await user review, not final-completed. SOP redesign TOOLS-68 remains NOT STARTED. Four other skill discussions and broader resources/build work stay open.

## User acceptance — 2026-10-28

The user accepted the unbundling/archival result and directed the discussion to the next skill. Final-complete only TOOLS-64 and its three children. The independent SOP redesign in TOOLS-68 and all remaining skill decisions stay open.

---

# Activity Log

## 2026-10-28T17:55:43.584Z

- **status**: NOT STARTED → IN PROGRESS
- **assignee**: UNASSIGNED → AGENT

## 2026-10-28T18:12:44.154Z

- **status**: IN PROGRESS → NEEDS REVIEW

## 2026-10-28T18:13:33.640Z

- **description**: 1 line → updated (11 lines)

## 2026-10-28T18:22:55.197Z

- **description**: 11 lines → updated (15 lines)

## 2026-10-28T18:22:55.458Z

- **status**: NEEDS REVIEW → COMPLETE
- **resolution**: DONE
