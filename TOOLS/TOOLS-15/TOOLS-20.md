---
title: "Add npm-pack global install smoke gate for immutable artifacts"
status: COMPLETE
resolution: DONE
kind: SUBTASK
priority: HIGH
assignee: UNASSIGNED
reporter: USER
created_at: 2026-05-08T21:36:25.841Z
depends_on:
  - TOOLS-16
updated_at: 2026-05-08T22:31:30.816Z
---

# Add npm-pack global install smoke gate for immutable artifacts

Add an end-to-end package-install verification gate that exercises the real npm artifact instead of the local `dist/` directory directly.

The test should:
- Build/assemble the distribution from a clean `dist/`.
- Run `npm pack ./dist`.
- Install the generated tarball into a temporary global prefix with lifecycle scripts disabled.
- Make the installed package directory read-only where the platform supports it.
- Run `sandpiper --help` through the installed global bin.
- Assert required package-relative runtime assets exist in the installed package tree.

This gate should protect the removal of install lifecycle hooks and catch missing files, dropped symlinks, or accidental runtime writes.

---

# Activity Log

## 2026-05-08T21:36:25.887Z

- **description**: added (11 lines)

## 2026-05-08T21:36:36.804Z

- **depends_on**: (none) → TOOLS-16

## 2026-05-08T22:31:30.817Z

- **status**: NOT STARTED → COMPLETE
- **resolution**: DONE
