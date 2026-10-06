---
title: "Reassess build and distribution topology for Pi 1.0"
status: NOT STARTED
kind: SUBTASK
priority: MEDIUM
assignee: UNASSIGNED
reporter: AGENT
created_at: 2026-10-06T02:57:59.778Z
updated_at: 2026-10-06T02:57:59.778Z
depends_on:
  - AGENT-293
---

# Reassess build and distribution topology for Pi 1.0

AGENT-290 step 5. The generated dist/package.json is both the standalone CLI and a Pi package. Pi 1.0 warns when host-provided packages appear in dependencies and recommends star peer ranges, which conflicts with the repo's exact-version policy. Distribution copies all of Pi's dist/modes and dist/core (about 8.6 MB) for themes, assets, and export templates. devtools/clean.ts does not remove .turbo and has depth-limited nested dist cleanup. Propose a topology, then implement the agreed increments.
