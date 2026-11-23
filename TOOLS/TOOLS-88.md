---
title: "Archive and unbundle all prompt templates"
status: COMPLETE
resolution: DONE
kind: TASK
priority: MEDIUM
assignee: AGENT
reporter: USER
created_at: 2026-10-28T22:39:57.636Z
updated_at: 2026-11-23T22:02:39.881Z
related:
  - TOOLS-58
  - TOOLS-30
---

# Archive and unbundle all prompt templates

## User acceptance — 2026-10-28

User accepted the five-ticket prompt-removal package ("Okay cool we can mark those done"). This ticket is COMPLETE/DONE. Existing verification and preservation evidence below remains valid; no code changes were needed for acceptance. TOOLS-33 stays open for the unresolved themes review.

## Implementation and review record

## Implementation verified — ready for review

All six prompts archived unchanged (14,638 bytes; file modes0644) in the separate sandpiper-archive repository, a new separate jj-managed cold archive. Bundled source/staged/packed copies removed. Custom prompt support remains. Missing owned optional skill/prompt directories are supported across staging, bootstrap and discovery; existing theme requirements remain. No prompt/SOP rewrite or automatic archive loading. Implementation is ready for user review, not final acceptance.

Verification: baseline87 files/642 tests passed. Individual expected RED→minimum GREEN→refactor assessment cycles covered zero defaults with a configured custom prompt, missing source prompt staging, missing prompts/skills bootstrap, and omitted absent owned prompt paths. Packed absence RED confirmed stale built templates, then normal builds fixed it. Final bun check clean; full87 files/645 tests pass without unhandled errors; bun run pack:cli passes. Actual tarball has no builtin prompt/skill definitions, archive paths or fixture-prompt. Theme scaffold remains unchanged.

Independent read-only prompts-audit 0dff7f54fbaf PASS: original six filenames/bytes/SHA-256/modes, license/provenance, no active retired-template routes, corrected active docs, isolated custom prompt support, and final tarball. Five prior skill archives, global settings, WIP jj replacement skills and independent Claude copy are unchanged.

Local revisions: Sandpiper qswrsxnm/bcd004aa; external sandpiper-archive tpmzonpn/cb8fe70c. Both are committed locally; no remote, install, archive registration or project-index change. Archive README and original license are outside the six preserved prompt files.

## Original scope

User approved retiring all six unused prompt templates and chose the separate sandpiper-archive repository as their external cold archive. Preserve all original filenames, bytes and modes unchanged in a separate jj-managed archive repository; no prompt registration/autoload/install. Remove bundled copies and update staging, bootstrap, owned path discovery, tests and documentation for zero built-in prompts while preserving custom prompt support. Existing skills archives, settings and WIP jj replacement remain untouched. Themes decision TOOLS-59 and unrelated work remain open. Use autonomous individual RED→GREEN→REFACTOR cycles; finish at NEEDS REVIEW pending acceptance.

---

# Activity Log

## 2026-10-28T22:40:54.254Z

- **status**: NOT STARTED → IN PROGRESS
- **assignee**: UNASSIGNED → AGENT

## 2026-10-28T22:58:05.430Z

- **description**: 1 line → updated (13 lines)

## 2026-10-28T22:58:06.248Z

- **status**: IN PROGRESS → NEEDS REVIEW

## 2026-11-02T15:41:22.913Z

- **description**: 13 lines → updated (19 lines)

## 2026-11-02T15:41:22.977Z

- **status**: NEEDS REVIEW → COMPLETE
- **resolution**: DONE

## 2026-11-23T22:02:39.881Z

- **description**: updated
