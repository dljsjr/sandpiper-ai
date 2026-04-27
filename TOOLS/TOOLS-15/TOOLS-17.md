---
title: "Build a TypeScript distribution assembler"
status: COMPLETE
resolution: DONE
kind: SUBTASK
priority: HIGH
assignee: UNASSIGNED
reporter: USER
created_at: 2026-05-08T21:36:25.528Z
depends_on:
  - TOOLS-16
updated_at: 2026-05-08T22:31:30.663Z
---

# Build a TypeScript distribution assembler

Replace the shell-based distribution assembly path with a typed build tool, e.g. `devtools/assembleDistribution.ts`.

The assembler should:
- Copy extensions, package outputs, shared resources, prompts, themes, and public docs into `dist/`.
- Apply the existing source-exclusion policy without relying on `rsync`.
- Generate `dist/package.json` through the existing TypeScript package metadata code.
- Build or copy helper binaries/scripts required by bundled skills.
- Be idempotent and safe to run after `rm -rf dist`.

Constraints:
- Keep `dist/` generated; do not edit generated artifacts by hand.
- Prefer Node/Bun filesystem APIs over shell commands or new portability dependencies.
- Preserve current distribution tests while incrementally replacing the shell script.

---

# Activity Log

## 2026-05-08T21:36:25.575Z

- **description**: added (13 lines)

## 2026-05-08T21:36:36.698Z

- **depends_on**: (none) → TOOLS-16

## 2026-05-08T22:31:30.664Z

- **status**: NOT STARTED → COMPLETE
- **resolution**: DONE
