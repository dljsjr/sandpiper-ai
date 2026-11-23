---
title: "Record the approved standalone journal v1 design"
status: COMPLETE
resolution: DONE
kind: TASK
priority: MEDIUM
assignee: AGENT
reporter: USER
created_at: 2026-10-27T16:34:47.211Z
updated_at: 2026-11-23T22:05:40.361Z
related:
  - TOOLS-47
---

# Record the approved standalone journal v1 design

Saved the agreed design in .sandpiper/archive/agent-journal-v1-spec-2026-10.md and indexed it in .sandpiper/docs/README.md. Target repository: agent-journal (https://github.com/dljsjr/agent-journal), created by the user as a colocated jj/Git repository with mise.toml selecting node=lts. Node 24+ is approved; mise exec verified v24.22.1. CLI and skill: journal. No implementation was started in this session; this task is the design and handoff checkpoint only. Preserve .sandpiper/standup.md unchanged, including during continuity checkpointing.

Approved contract: 500 normalized content characters; one quoted positional argument with newlines replaced by spaces and outer whitespace trimmed; empty/oversized entries rejected; 200 retained entries; newest-first Markdown with local-day headers and timestamp offsets; optional explicit author attribution; author filtering before default latest-matching-day selection; default 20 returned entries; positive --limit override; omission counts; mutually exclusive --date and inclusive --since; explicit dates override the latest-day selection.

Date implementation: ISO format gate/native handling first, then Chrono only as fallback. Calendar normalization is deliberately accepted, with no separate leap-year/day-count validator. Preserve local date semantics rather than blindly parsing date-only input as UTC. Chrono must yield exactly one complete, non-range match; its end field can be null. Custom Chrono parser ordering is not a short-circuit. User offered a regex-first reference from the separate pi-yaams repository; that file was inspected but not modified.

Configuration: --dir overrides AGENT_JOURNAL_DIR, otherwise .agent-journal/ relative to CWD; fixed journal.md filename. Sandpiper supplies an absolute .sandpiper directory through the environment before children start, preserving a user-supplied value. No harness-specific behavior belongs in the standalone CLI or skill.

Locking: Node opens a persistent sidecar lock file and passes it as child fd 3 to /usr/bin/lockf on macOS or /usr/bin/flock on Linux. The utility exits after acquiring the shared open-file-description lock, retained by the Node fd. Keep the lock through the entire read/modify/atomic-replacement transaction and release by closing the fd. No native npm addon, FFI, SQLite, PID registry, stale-file cleanup, or lock-file unlink. Linux remotes already have flock according to the user; Linux execution still needs verification. Exact lock timeout is not selected.

The spec records the mechanics independently of temporary files.

Remaining mechanical details: serialized Markdown metadata, author matching particulars, empty/missing-file output, character counting unit, dependency installation layout, and legacy code/skill transition scope. Do not create implementation or release work merely because this design checkpoint exists. No legacy migration/deletion is authorized.

Verification: spec index and local reference checks passed; root bun check passed dependency policy, TypeScript and Biome with zero warnings. Existing review TOOLS-47 remains NEEDS REVIEW; do not sweep unrelated tasks.

End-session handoff (2026-10-27): the agent-journal README points to its handoff and spec. Those files are self-contained and the standalone spec is the implementation reference. The user-provided mise.toml was preserved unchanged and committed as qtorzlls. The handoff documentation is in change ovmnzyvr. A global inbox discovery pointer exists in the user's global agent setup, and the repository is registered as active in projects.toon. No further product decisions were identified as blocking v1. The next agent must read the standalone handoff rather than restart the design or infer current state from the legacy standup. The legacy standup file was not modified.

Final verification: mise exec in the new repository reports Node v24.22.1; new document links and matching contract copies verified; the original mise contents match exactly; Sandpiper bun check passes with zero warnings. The standalone repository still has no application code or application test suite. The design is ready for the next session, without introducing release or installer scope.

## Bookkeeping acceptance — 2026-10-27

Accepted the approved Journal design and standalone handoff checkpoint. Its specification remains present and indexed. Standalone implementation and the Sandpiper/global adoption were subsequently completed and accepted under TOOLS-51. Historical design-stage open details do not represent unfinished work on this checkpoint.

Current verification: bun check passed with zero errors/warnings; bun run test rebuilt package output and passed 87 files / 640 tests, including packed-install, cache-restoration and temporary Trail bridge regressions. Closure requested during the return to build/packaging simplification. Original historical verification is retained above.

---

# Activity Log

## 2026-10-27T16:34:52.947Z

- **status**: NOT STARTED → IN PROGRESS
- **assignee**: UNASSIGNED → AGENT

## 2026-10-27T16:39:41.212Z

- **description**: 1 line → updated (15 lines)

## 2026-10-27T16:39:41.288Z

- **status**: IN PROGRESS → NEEDS REVIEW

## 2026-10-27T17:05:51.826Z

- **status**: NEEDS REVIEW → IN PROGRESS

## 2026-10-27T17:07:15.287Z

- **description**: 15 lines → updated (19 lines)

## 2026-10-27T17:07:15.399Z

- **status**: IN PROGRESS → NEEDS REVIEW

## 2026-10-28T01:17:06.216Z

- **description**: 19 lines → updated (25 lines)

## 2026-10-28T01:17:06.279Z

- **status**: NEEDS REVIEW → COMPLETE
- **resolution**: DONE

## 2026-11-23T22:02:38.497Z

- **description**: updated

## 2026-11-23T22:05:40.361Z

- **description**: updated
