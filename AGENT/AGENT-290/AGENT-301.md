---
title: "Reassess build and distribution topology for Pi 1.0"
status: NOT STARTED
kind: SUBTASK
priority: MEDIUM
assignee: UNASSIGNED
reporter: AGENT
created_at: 2026-10-06T02:57:59.778Z
updated_at: 2026-10-06T18:23:49.981Z
depends_on:
  - AGENT-293
---

# Reassess build and distribution topology for Pi 1.0

The generated dist/package.json is both the standalone CLI and a Pi package. Pi 1.0 warns when host-provided packages appear in dependencies, and recommends star peer ranges, which conflicts with the repo's exact-version policy. Distribution copies all of Pi's dist/modes and dist/core (about 8.6 MB) for themes, assets, and export templates. devtools/clean.ts does not remove .turbo, and its nested dist cleanup is depth-limited.

Steps:
1. Write a topology proposal under .sandpiper/docs/specs/:
   - separate CLI and Pi-package artifacts, or one artifact
   - the smallest set of Pi assets to copy
   - clean-output fixes
   - how the local Pi patch reaches each artifact
2. Bring Doug the one policy question: Pi's star peer ranges versus the repo's exact pins.
3. Implement the agreed increments as separate jj changes with `Refs: AGENT-301`.

Done when: the agreed topology is implemented, and rm -rf dist && env -u PI_PACKAGE_DIR bun run test:distribution is green.

---

# Activity Log

## 2026-10-06T18:23:49.982Z

- **description**: 1 line → updated (12 lines)
