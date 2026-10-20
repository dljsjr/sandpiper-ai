---
title: "Remove the bundled projects skill and update discovery and packaging contracts"
status: COMPLETE
resolution: DONE
kind: SUBTASK
priority: MEDIUM
assignee: AGENT
reporter: USER
created_at: 2026-10-28T16:53:38.895Z
updated_at: 2026-10-28T17:32:56.448Z
---

# Remove the bundled projects skill and update discovery and packaging contracts

Use focused failing discovery/packed-catalogue assertions, remove the source skill, update relevant Sandpiper docs and expected built-in catalogues, then build and verify hermetically. Edit source, never generated dist.

## Implementation and verification — 2026-10-28

Implemented in qyrnsszt/a447db7e. Removed only packages/resources/skills/projects/SKILL.md and its directory; updated the source catalogue README, public directory reference and discovery/packaging expectations. Two source-discovery cases and the packed-install test failed first because projects was still present, then passed after removal/build. bun check is clean; bun run test passes 87 files/640 tests including offline, script-disabled, read-only packed installation outside the checkout. bun run pack:cli succeeds; actual tarball has exactly five remaining skill entrypoints and no projects skill directory. The other five skills are unchanged.

---

# Activity Log

## 2026-10-28T16:54:02.647Z

- **status**: NOT STARTED → IN PROGRESS
- **assignee**: UNASSIGNED → AGENT

## 2026-10-28T17:12:43.230Z

- **description**: 1 line → updated (5 lines)

## 2026-10-28T17:12:43.290Z

- **status**: IN PROGRESS → NEEDS REVIEW

## 2026-10-28T17:32:56.449Z

- **status**: NEEDS REVIEW → COMPLETE
- **resolution**: DONE
