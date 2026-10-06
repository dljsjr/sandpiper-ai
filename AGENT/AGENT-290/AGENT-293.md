---
title: "Bump Pi pins to 1.0.4 and fix test doubles"
status: COMPLETE
resolution: DONE
kind: SUBTASK
priority: HIGH
assignee: AGENT
reporter: AGENT
created_at: 2026-10-06T02:57:59.152Z
updated_at: 2026-10-06T20:30:59.649Z
---

# Bump Pi pins to 1.0.4 and fix test doubles

Move every @earendil-works/pi-* pin from 0.85.1 to 1.0.4 across the root, packages/cli, extensions, and plugins manifests, keeping exact versions per check:deps. Regenerate bun.lock.

The scratch build on 1.0.3 found four tsc errors. Re-derive the list on 1.0.4:
- extensions/system/extension-factories.test.ts and packages/cli/sandpiper_resources.test.ts: pi.on test doubles must return an unsubscribe function.
- extensions/system/turn-control-tool.test.ts: tool execute now receives ExtensionToolContext.
- devtools/integration/mock-provider.ts: ToolCall.arguments must be JSON values, and streamSimple now receives TranscriptContext.

Steps:
1. From the current default head, run `jj workspace add ../sandpiper-ai-pi1` and work there until AGENT-290's end-to-end check passes. Run `mise trust` in the new workspace first: an untrusted mise.toml leaves node-gyp without Python (seen 2026-10-05).
2. Bump the pins, run `bun install` at the repo root, then `bun run check:deps`.
3. Run `bun check` and fix the type errors.
4. Run `bun run test`, then `rm -rf dist && env -u PI_PACKAGE_DIR bun run test:distribution`.
5. One jj change with `Refs: AGENT-293`.

Done when: bun check is clean, bun run test is green, and rm -rf dist && env -u PI_PACKAGE_DIR bun run test:distribution is green. This step alone ships the prompt regressions, so do not use the result as a daily driver until AGENT-290's prompt subtasks land.

---

# Activity Log

## 2026-10-06T17:25:17.658Z

- **title**: Bump Pi pins to 1.0.3 and fix test doubles → Bump Pi pins to 1.0.4 and fix test doubles
- **description**: updated

## 2026-10-06T18:23:49.593Z

- **description**: 8 lines → updated (15 lines)

## 2026-10-06T18:54:55.937Z

- **status**: NOT STARTED → IN PROGRESS
- **assignee**: UNASSIGNED → AGENT

## 2026-10-06T18:58:22.439Z

- **status**: IN PROGRESS → NEEDS REVIEW

## 2026-10-06T20:30:59.650Z

- **status**: NEEDS REVIEW → COMPLETE
- **resolution**: DONE
