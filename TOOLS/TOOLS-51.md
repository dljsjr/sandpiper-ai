---
title: "Cut over runtime and cross-project guidance from legacy standup to Journal"
status: COMPLETE
resolution: DONE
kind: TASK
priority: HIGH
assignee: AGENT
reporter: USER
created_at: 2026-10-27T22:13:40.756Z
updated_at: 2026-10-27T23:52:36.700Z
related:
  - TOOLS-47
  - TOOLS-50
---

# Cut over runtime and cross-project guidance from legacy standup to Journal

User explicitly approved a full cutover: install the local standalone Journal package globally; remove Sandpiper's old bundled standup CLI/skill and integration; replace global AGENTS/playbooks/roles, project guidance and Sandpiper internal/public docs. Closed Trail tickets and existing note contents are immutable. Inventory source ownership and dirty repo state first; edit source, not generated artifacts. Keep continuity usable: respect Journal's approved standalone contract and stable host directory behavior, preserve explicit user overrides, avoid task-tracker assumptions. Use a continuous developer/adversarial-reviewer pair and bounded repo/slice reviews. No unrelated cleanup, legacy-note migration/deletion, publishing, closed-eval reruns or task sweep. Verify rebuilt runtime/distribution and classified residual scan, preserving other concurrent work.

## Implementation and verification complete; pending lead acceptance

Full runtime/guidance/global-adoption cutover is implemented and independently accepted through Sandpiper source c9fc7a05. Parent retains final completion authority. Complete packet: /private/tmp/journal-cutover-jt1zotyw/final-packet.md. Owner/file/revision manifest: final-source-manifest.json in that directory.

Final developer and reviewer checks are clean; full Sandpiper suite87files/640tests, standalone Journal42tests. Real-Turbo cache-hit upgrade defect was reproduced and fixed at both root build seams, then independently verified by seeded output probes. Final tarball16985entries has no old page/skill/helper or rebundledJournal. Both built entrypoints and changed-cwd children pass8default/override cases. Real global install only appends ../../git/agent-journal after all5existingpackages/order; other settings unchanged.

All27savednotes +20unrelatedpaths/absences +1689immutableclosed/all-Trailrecords remain byte-identical. Eleven unversioned guidance targets retain exact before backups/diffs/hashes/modes. Final -uu215-path residual classification finds no active retired-flow directions; historical/data/negative-test matches remain intentionally. Earlier unchanged5second smoke timeouts are retained in evidence; final standard full runs passed without budget changes. No saved-note migration/deletion, pre-existing COMPLETE ticket changes, model evals, releases, pushes, or unrelated cleanup.

Lead-approved adoption tail: ppxlplkw/5fda5cab commits only the lead-generated first .sandpiper/journal.md and exact .gitignore rule .sandpiper/.journal.lock. Documented jj file untrack used only after ignoring; physical lock inode/content/mode and journal inode/content/mode remained exact through commit. Reviewer independently accepted this2file/5added-line checkpoint. All task statuses left for lead final acceptance. Evidence adoption-tail-after-commit.json and review-workspace-cleanup-provenance.json under the packet directory. Current parent process requires restart for refreshed installed skill catalogue/startup environment; fresh processes pass. Owned review clone cleanup has not been performed and is explicitly distinguished from pre-existing user-note preservation.

## Lead acceptance — 2026-10-27

Accepted runtime/guidance source through c9fc7a05 and the independently reviewed adoption-only checkpoint 5fda5cab. No unresolved findings. The one-assignment host default, local staging filter and owned-output cleanup preserve the standalone boundary without new runtime abstractions or dependencies. Seven owner checkouts are clean; pre-existing global/Birdup/RG work remains in separate checkpoints.

Developer and reviewer full gates: Sandpiper87files/640tests and standalone Journal42tests, checks clean. Lead independently ran bun check (zero errors/warnings), four focused files/18tests, and eight real runtime/diagnostic plus child-cwd cases. Fresh catalogue resolves external Journal plus six built-ins, no retired skill or warnings. Final tarball SHA256230eaac6390d30d8d3efcf8db627529efa27d41f3c9d45d03c5e7cd84667ec08 matches the accepted distribution. Cache-hit upgrade regression and packed absence checks pass. Real settings retain every prior nonpackage value and the original five-package order, with only ../../git/agent-journal appended.

Lead post-cleanup preservation:26 original saved-note/CHECKPOINT paths,20 unrelated file hashes/absences and1689 protected closed/archive/all-standalone-Trail records match. The27th note baseline was an identical copy in our newly created review checkout; it was verified against the unchanged canonical original before owned-workspace removal. Eleven unversioned backups/current hashes/modes match. The real persistent Journal lock is ignored/untracked and retains inode83736154; the lead-published first journal entry is committed unchanged. No existing note migration/deletion, closed-ticket edits, evaluations, release, push or bookmark advance occurred.

Evidence: /private/tmp/journal-cutover-jt1zotyw/final-packet.md, final-source-manifest.json, semantic-residual-audit.md, lead-final-probes.json, lead-final-preservation-after-cleanup.json and adoption-tail-*.json. Existing historical evidence/negative fixtures/ignore safeguards remain classified, not rewritten to force keyword-zero. Both Fling workers are closed; only the owned temporary review workspace was removed. Current already-running Sandpiper process needs restart for its cached package catalogue/bootstrap environment; fresh compiled processes already pass. This is an activation caveat, not unfinished implementation.

Final completion uses the user's delegated lead acceptance authority.

---

# Activity Log

## 2026-10-27T22:15:03.779Z

- **status**: NOT STARTED → IN PROGRESS
- **assignee**: UNASSIGNED → AGENT

## 2026-10-27T23:36:18.183Z

- **description**: 1 line → updated (9 lines)

## 2026-10-27T23:36:18.909Z

- **status**: IN PROGRESS → NEEDS REVIEW

## 2026-10-27T23:49:23.973Z

- **description**: 9 lines → updated (11 lines)

## 2026-10-27T23:52:36.336Z

- **description**: 11 lines → updated (23 lines)

## 2026-10-27T23:52:36.701Z

- **status**: NEEDS REVIEW → COMPLETE
- **resolution**: DONE
