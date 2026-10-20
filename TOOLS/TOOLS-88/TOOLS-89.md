---
title: "Preserve all six prompts in the external Sandpiper archive"
status: COMPLETE
resolution: DONE
kind: SUBTASK
priority: MEDIUM
assignee: AGENT
reporter: USER
created_at: 2026-10-28T22:40:53.924Z
updated_at: 2026-11-02T15:41:22.433Z
---

# Preserve all six prompts in the external Sandpiper archive

## User acceptance — 2026-10-28

User accepted the five-ticket prompt-removal package ("Okay cool we can mark those done"). This ticket is COMPLETE/DONE. Existing verification and preservation evidence below remains valid; no code changes were needed for acceptance. TOOLS-33 stays open for the unresolved themes review.

## Implementation and review record

## Implementation verified — ready for review

Exact six-file original prompt tree copied and verified before source removal. Preserved names, bytes, hashes and modes. New separate jj archive repo contains only original prompts plus provenance README and original LICENSE; no package manifest/build/install. Archive committed; all prior archives/config/WIP/independent-copy fingerprints match.

Verification: baseline87 files/642 tests passed. Individual expected RED→minimum GREEN→refactor assessment cycles covered zero defaults with a configured custom prompt, missing source prompt staging, missing prompts/skills bootstrap, and omitted absent owned prompt paths. Packed absence RED confirmed stale built templates, then normal builds fixed it. Final bun check clean; full87 files/645 tests pass without unhandled errors; bun run pack:cli passes. Actual tarball has no builtin prompt/skill definitions, archive paths or fixture-prompt. Theme scaffold remains unchanged.

Exact before/after manifests and preservation checks: ~/.sandpiper/agent/backups/prompts-unbundle-20261028-I93Jj7/{before.json,archive-verified.json,preservation-after.json}. Independent read-only prompts-audit 0dff7f54fbaf PASS: original six filenames/bytes/SHA-256/modes, license/provenance, no active retired-template routes, corrected active docs, isolated custom prompt support, and final tarball. Five prior skill archives, global settings, WIP jj replacement skills and independent Claude copy are unchanged.

Local revisions: Sandpiper qswrsxnm/bcd004aa; external sandpiper-archive tpmzonpn/cb8fe70c. Both are committed locally; no remote, install, archive registration or project-index change. Archive README and original license are outside the six preserved prompt files.

## Original scope

Archive exact original filenames/bytes/modes under ~/git/sandpiper-archive/prompts before deleting bundled sources. Use a separate jj-managed cold archive repository, with provenance outside the unchanged prompt files. No archive autoload/registration and no unrelated state changes.

---

# Activity Log

## 2026-10-28T22:40:54.335Z

- **status**: NOT STARTED → IN PROGRESS
- **assignee**: UNASSIGNED → AGENT

## 2026-10-28T22:58:05.543Z

- **description**: 1 line → updated (13 lines)

## 2026-10-28T22:58:06.058Z

- **status**: IN PROGRESS → NEEDS REVIEW

## 2026-11-02T15:41:22.351Z

- **description**: 13 lines → updated (19 lines)

## 2026-11-02T15:41:22.434Z

- **status**: NEEDS REVIEW → COMPLETE
- **resolution**: DONE
