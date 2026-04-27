---
title: "Review restored package and CLI version edits"
status: COMPLETE
resolution: WONTFIX
kind: TASK
priority: MEDIUM
assignee: UNASSIGNED
reporter: AGENT
created_at: 2026-04-27T17:27:50.940Z
updated_at: 2026-07-13T04:17:00.910Z
---

# Review restored package and CLI version edits

Review the pre-existing package/CLI edits restored after the reinforced-guidance cut-over. This is the intended next core Sandpiper handoff task.

Current dirty files:

- package.json
- bun.lock
- packages/cli/pi_wrapper.ts

Observed diff summary:

- package catalog `pi`: `@mariozechner/pi-coding-agent` and `@mariozechner/pi-tui` from `0.68.1` to `0.70.2`
- package catalog `ts`: `@types/bun` from `1.3.12` to `1.3.13`
- package catalog `codec`: `fast-xml-parser` from `5.7.1` to `5.7.2`
- `packages/cli/pi_wrapper.ts`: one blank line changed to a `//` separator comment before the Explicit PI_* variables section
- `bun.lock`: lockfile updates corresponding to the package catalog changes

Decide whether these should be committed, adjusted, or restored. Ensure `node-llama-cpp` is not reintroduced. Run `bun install`, `bun check`, and `bun run sandpiper-dev --version` before committing any package/version outcome.

---

# Activity Log

## 2026-04-27T17:27:50.979Z

- **description**: added (1 line)

## 2026-04-27T17:45:37.359Z

- **description**: 1 line → updated (50 lines)

## 2026-04-27T17:45:47.076Z

- **description**: 50 lines → updated (17 lines)

## 2026-07-13T04:17:00.914Z

- **status**: NOT STARTED → COMPLETE
- **resolution**: WONTFIX
