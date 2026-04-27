---
title: "Materialize publish artifact assets without symlink or runtime writes"
status: COMPLETE
resolution: DONE
kind: SUBTASK
priority: HIGH
assignee: UNASSIGNED
reporter: USER
created_at: 2026-05-08T21:36:25.630Z
depends_on:
  - TOOLS-16
  - TOOLS-17
updated_at: 2026-05-08T22:31:30.712Z
---

# Materialize publish artifact assets without symlink or runtime writes

Make the npm-packed Sandpiper artifact complete and immutable.

Problems to eliminate:
- `npm pack` drops symlinked publish-critical assets such as generated Pi asset links.
- The CLI currently creates `dist/standalone-package` and symlinks docs/Pi internals at runtime for some execution paths.

Target behavior:
- Required package metadata, public docs, Pi asset paths, resources, extensions, and helper scripts are present in the package tarball before install.
- Runtime startup does not write into the installed package directory.
- The package still works when installed with lifecycle scripts disabled and the package directory made read-only.

---

# Activity Log

## 2026-05-08T21:36:25.675Z

- **description**: added (10 lines)

## 2026-05-08T21:36:36.750Z

- **depends_on**: (none) → TOOLS-16, TOOLS-17

## 2026-05-08T22:31:30.713Z

- **status**: NOT STARTED → COMPLETE
- **resolution**: DONE
