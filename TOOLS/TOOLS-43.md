---
title: "Replace the temporary archived Trail skill bridge with standalone integration"
status: COMPLETE
resolution: DONE
kind: TASK
priority: MEDIUM
assignee: AGENT
reporter: USER
created_at: 2026-10-26T14:44:09.351Z
updated_at: 2026-11-19T20:14:37.153Z
related:
  - TOOLS-42
  - TOOLS-38
---

# Replace the temporary archived Trail skill bridge with standalone integration

Temporary integration tracked by TOOLS-42 checks PATH for trail and hard-codes ~/git/skills-incubator/skills/trail for its skill. The archived skill is renamed from tasks to trail and its commands use PATH. This is a local development bridge, not the final portable integration. Remove the archived-skill hard-code once the user supplies the standalone Trail discovery/release contract. Replace it with the agreed PATH-first, managed-cache, stable-release strategy including matching CLI+skill, offline/atomic/integrity behavior, and explicit opt-out. Do not query undocumented Trail flags or contact the standalone Trail agent; the user coordinates that work. Keep this ticket open after the bridge implementation is ready for review.

## Outcome (qsvntuyv)

Trail now ships as a Pi package (`~/git/trail`) with its own `trail` skill and an extension that puts its `bin/` on PATH, so Sandpiper needs no discovery of its own. Removed `packages/cli/temporary_trail_skill.ts`, its tests, and the `sandpiper-resources` inline extension; the standalone resource discovery test dropped its Trail case; the build playbook no longer lists the bridge. Per Doug: the Trail agent migrated this repo's board, and Doug installs the Trail package himself.

Checks: bun check clean, 91 files/854 tests, dist rebuilt.

---

# Activity Log

## 2026-11-19T16:56:25.804Z

- **status**: NOT STARTED → IN PROGRESS
- **assignee**: UNASSIGNED → AGENT

## 2026-11-19T16:56:26.136Z

- **status**: IN PROGRESS → NEEDS REVIEW
- **description**: 1 line → updated (7 lines)

## 2026-11-19T20:14:37.153Z

- **status**: NEEDS REVIEW → COMPLETE
- **resolution**: UNRESOLVED → DONE
