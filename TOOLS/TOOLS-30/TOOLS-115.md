---
title: "Correct and archive documents from the retained-surface inventory"
status: COMPLETE
resolution: DONE
kind: SUBTASK
priority: MEDIUM
assignee: "docs-fix"
reporter: USER
created_at: 2026-11-11T16:00:15.159Z
updated_at: 2026-11-11T16:18:41.386Z
related:
  - TOOLS-92
---

# Correct and archive documents from the retained-surface inventory

## Delivered, awaiting review (2026-11-11)

Agent docs-fix (Sonnet 5.5, high) delivered two commits from an isolated workspace: change povnoptv "docs: Correct statements that no longer match the code" (25 files) and change pkmrtswq "docs: Archive finished notes, reviews, and specs" (14 files moved, 5 index rows removed). All 15 rows are done. The coordinator combined them with the main line without conflict and ran bun check on the result: clean. No test file changed; the two code edits are comments.

The agent also removed the unsourced 30 to 60 percent saving from the root README, and fixed one path in web-fetch-prd.md.

Left for other work: a comment in extensions/chorus/chorus-ui.ts line 89 says tool render options lack outputPad as of Pi 0.84.0; Pi 1.5.2 has it, so the fallback may be unnecessary. CONTRIBUTING.md line 40 and docs/concepts/directory-layout.md still describe .sandpiper/reviews/, which no longer exists here. The web-search README now documents project-local settings as the code reads them today; WEB-22 changes that behavior and must update the sentence.

## Decision

Doug, 2026-11-11: wrong documentation needs no approval; fix it. This task carries out Section 6 (Batch C) of .sandpiper/docs/specs/retained-surface-inventory.md: rows C-1 to C-15.

## Scope

- Correct the false statements in rows C-1 to C-9 and C-13 to C-15.
- Move the finished notes, reviews and specs in rows C-10 to C-12 to .sandpiper/archive/ and fix the links and index rows that point at them. extensions/web-search/SCOUT.md stays where it is; TOOLS-109 moves it.

## Limits

- No reformatting of files that are not Prettier-clean; TOOLS-114 formats everything later.
- Documents that describe features with open tasks (TOOLS-109 to TOOLS-113, AGENT-321 to AGENT-323, WEB-22) are corrected to match the code as it is today, not as it will be.

---

# Activity Log

## 2026-11-11T16:00:15.262Z

- **status**: NOT STARTED → IN PROGRESS
- **assignee**: UNASSIGNED → docs-fix

## 2026-11-11T16:16:14.732Z

- **description**: 13 lines → updated (21 lines)

## 2026-11-11T16:16:14.869Z

- **status**: IN PROGRESS → NEEDS REVIEW

## 2026-11-11T16:18:41.388Z

- **status**: NEEDS REVIEW → COMPLETE
- **resolution**: DONE
