---
title: "Review and resolve bundled prompt templates"
status: COMPLETE
resolution: DONE
kind: SUBTASK
priority: MEDIUM
assignee: AGENT
reporter: USER
created_at: 2026-10-28T14:17:40.381Z
updated_at: 2026-11-02T15:41:23.154Z
---

# Review and resolve bundled prompt templates

## User acceptance — 2026-10-28

User accepted the five-ticket prompt-removal package ("Okay cool we can mark those done"). This ticket is COMPLETE/DONE. Existing verification and preservation evidence below remains valid; no code changes were needed for acceptance. TOOLS-33 stays open for the unresolved themes review.

## Implementation and review record

## Prompt review resolved; implementation ready for acceptance — 2026-10-28

User chose removal/archive for all six unused templates, with the external location ~/git/sandpiper-archive/prompts. TOOLS-88–91 implements that decision, preserving originals unchanged and retaining custom prompt capability. Verification: baseline87 files/642 tests passed. Individual expected RED→minimum GREEN→refactor assessment cycles covered zero defaults with a configured custom prompt, missing source prompt staging, missing prompts/skills bootstrap, and omitted absent owned prompt paths. Packed absence RED confirmed stale built templates, then normal builds fixed it. Final bun check clean; full87 files/645 tests pass without unhandled errors; bun run pack:cli passes. Actual tarball has no builtin prompt/skill definitions, archive paths or fixture-prompt. Theme scaffold remains unchanged.

Local revisions: Sandpiper qswrsxnm/bcd004aa; external sandpiper-archive tpmzonpn/cb8fe70c. Both are committed locally; no remote, install, archive registration or project-index change. Archive README and original license are outside the six preserved prompt files.

This task is ready for user review, not COMPLETE. TOOLS-59 themes remains NOT STARTED; TOOLS-30 stays IN PROGRESS and TOOLS-33 stays NEEDS REVIEW. Deferred SOP work and updater bug remain separate.

## Earlier decision and review record

## Approved six-prompt retirement — 2026-10-28

User does not use any retained prompt and approved archiving/removing all six, choosing ~/git/sandpiper-archive/prompts. Implementation TOOLS-88–91 preserves exact originals in a separate jj-managed cold archive and removes bundled copies without registration/autoload. No content/SOP rewrite is requested. Preserve custom prompt support; handle missing optional prompt directories across staging/bootstrap/discovery. Themes TOOLS-59 and overall review remain separate. Original prompt-specific review notes below are historical context, not a requirement to keep those workflows bundled.

## Earlier review context

Review the six retained prompt templates under packages/resources/prompts as part of the unfinished resources review. Record the user's decisions about what ships and where it belongs. Apply any approved changes and verify affected prompt discovery, staging, documentation and packed behavior before requesting acceptance. Do not assume that templates should be kept, removed or extracted.

Dependency maintenance under TOOLS-64 only made the deleted code-review skill optional in code-review/self-reflect prompts. This is not completion of the prompt review. The retained code-review prompt still prescribes quantitative analysis, a health summary and positive findings; assess those existing requirements during this review and coordinate with the deferred SOP rethink in TOOLS-68. No removal/rewrite decisions about these procedures are approved.

TOOLS-69 additionally made self-reflect's refactoring-skill mapping optional. The refactor prompt itself had no deleted-skill prerequisite and remains unchanged. These are dependency-maintenance edits only, not completion or acceptance of the pending prompt review.

TOOLS-74 additionally replaces self-reflect's retired TDD-skill mapping with project testing guidance and applicable installed skills. This mechanical dependency repair is verified in source and packed gates. It is not substantive prompt review or acceptance; this task remains NOT STARTED.

---

# Activity Log

## 2026-10-28T18:13:33.751Z

- **description**: 1 line → updated (3 lines)

## 2026-10-28T18:38:19.947Z

- **description**: 3 lines → updated (5 lines)

## 2026-10-28T20:11:32.079Z

- **description**: 5 lines → updated (7 lines)

## 2026-10-28T22:40:54.178Z

- **status**: NOT STARTED → IN PROGRESS
- **assignee**: UNASSIGNED → AGENT

## 2026-10-28T22:42:06.941Z

- **description**: 7 lines → updated (13 lines)

## 2026-10-28T22:58:05.883Z

- **description**: 13 lines → updated (23 lines)

## 2026-10-28T22:58:06.310Z

- **status**: IN PROGRESS → NEEDS REVIEW

## 2026-11-02T15:41:23.091Z

- **description**: 23 lines → updated (29 lines)

## 2026-11-02T15:41:23.155Z

- **status**: NEEDS REVIEW → COMPLETE
- **resolution**: DONE
