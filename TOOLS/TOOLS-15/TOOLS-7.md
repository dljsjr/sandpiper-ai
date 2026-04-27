---
title: "Convert remaining shell scripts to portable TypeScript"
status: COMPLETE
resolution: DONE
kind: SUBTASK
priority: MEDIUM
assignee: AGENT
reporter: AGENT
created_at: 2026-03-24T21:02:38.813Z
depends_on:
  - TOOLS-17
updated_at: 2026-05-08T22:31:30.872Z
---

# Convert remaining shell scripts to portable TypeScript

Replace build-tool shell scripts with portable TypeScript so the distribution/publish pipeline works consistently across macOS, Linux, Windows, and package-manager environments.

Scope:
- Convert `devtools/postinstall.sh` behavior into TypeScript-owned distribution assembly.
- Convert `devtools/preinstall.sh` behavior if it remains necessary; preferably eliminate it by removing install-time artifact scaffolding.
- Convert `devtools/vendor.sh` and `devtools/fetch-git-subdir.sh` into TypeScript vendoring tools.
- Keep shell-relay integration files (`relay.bash`, `relay.zsh`, `relay.fish`) as shell scripts because they are runtime/product assets, not build tooling.

Constraints:
- Do not introduce `shx`; prefer first-party Node/Bun APIs and small typed helpers.
- Keep generated artifacts out of source control and avoid hand-editing `dist/`.
- Preserve exact dependency metadata policy and npm-installable generated packages.

---

# Activity Log

## 2026-03-24T21:02:53.137Z

- **description**: added (1 line)

## 2026-03-28T19:41:37.122Z

- **status**: NOT STARTED → IN PROGRESS
- **assignee**: UNASSIGNED → AGENT

## 2026-03-29T00:37:46.877Z

- **status**: IN PROGRESS → NOT STARTED

## 2026-04-01T16:30:37.234Z

- **priority**: LOW → MEDIUM

## 2026-05-08T21:36:07.094Z

- **description**: 1 line → updated (12 lines)

## 2026-05-08T21:36:36.916Z

- **depends_on**: (none) → TOOLS-17

## 2026-05-08T22:31:30.873Z

- **status**: NOT STARTED → COMPLETE
- **resolution**: DONE
