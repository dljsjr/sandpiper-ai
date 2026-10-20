---
title: "Make standup CLI command tests cwd-independent"
status: COMPLETE
resolution: WONTFIX
kind: BUG
priority: HIGH
assignee: UNASSIGNED
reporter: USER
created_at: 2026-04-28T18:37:45.963Z
updated_at: 2026-11-12T19:39:41.215Z
---

# Make standup CLI command tests cwd-independent

Current disposition (TOOLS-51): the bundled standup CLI and its command tests are removed. Do not implement or run the retired helper workflow below. The original report is preserved as historical evidence; it was already stale at TOOLS-47 review. Parent review retains authority over this ticket status.

## Historical report (not current instructions)

# Bug — `sandpiper-standup-cli` tests are implicitly cwd-dependent

## Summary
All of `packages/sandpiper-standup-cli/src/commands/*.test.ts` invoke the built CLI as `node dist/sandpiper-standup ...` via `execSync`. That path is bare-relative and only resolves when the test runner is started from `packages/sandpiper-standup-cli/`. Running vitest from the repo root (e.g. `bun x vitest run` or a workspace-wide `bun run test`) crashes every one of them with `MODULE_NOT_FOUND`.

Reproduced on `main` (no involvement from the autotoon or aux-guidance branches):

```bash
cd ~/git/sandpiper-ai/packages/sandpiper-standup-cli && bun x vitest run src/commands/read-cmd.test.ts   # PASSES
cd ~/git/sandpiper-ai && bun x vitest run packages/sandpiper-standup-cli/src/commands/read-cmd.test.ts   # FAILS
```

The per-package `bun run --filter sandpiper-standup-cli test` path shields this by implicitly cd-ing into the package dir, which is why the bug has not been noticed in per-package CI loops.

## Impact
- Workspace-wide test runs (`bun x vitest run`) fail with ~37 test errors that look like pre-existing breakage but are really a single defect.
- Any future agent doing a "full workspace verification" step will be misled into thinking something is broken that isn't.
- Earlier standup-concurrency review passes (including my own) green-lit these tests only because they were always run from the package directory.

## Files
- `packages/sandpiper-standup-cli/src/commands/read-cmd.test.ts`
- `packages/sandpiper-standup-cli/src/commands/write-cmd.test.ts`
- `packages/sandpiper-standup-cli/src/commands/cleanup-cmd.test.ts`

Every `execSync(\`... node dist/sandpiper-standup ...\`, ...)` call is affected.

## Proposed fix
Replace every `node dist/sandpiper-standup` call with `bun x sandpiper-standup`.

Rationale:
- The workspace hoists the binary to `<repo_root>/node_modules/.bin/sandpiper-standup`, pointing at `packages/sandpiper-standup-cli/dist/sandpiper-standup`.
- `sandpiper-standup-cli/package.json` already has a `preinstall` script that builds `dist/sandpiper-standup` *before* the bin symlink gets created, so after any `bun install` the symlink is guaranteed to be valid.
- `bun x` resolves bins through `node_modules/.bin`, so it works from any cwd.
- This eliminates all knowledge of filesystem layout from the test code.
- It also exercises the actual canonical invocation users see, which is a nicer integration contract.

Assumption: tests already require `bun install` to have run (you can't invoke `bun x vitest` without an install either), so adding `bun x sandpiper-standup` introduces no new state requirement.

Example transform:

```ts
// before
execSync(`node dist/sandpiper-standup read -d ${testDir}`, { encoding: 'utf-8' });

// after
execSync(`bun x sandpiper-standup read -d ${testDir}`, { encoding: 'utf-8' });
```

If avoiding the `bun x` runtime overhead matters for test speed, the alternative is a once-per-file absolute path:

```ts
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
const CLI_BIN = resolve(dirname(fileURLToPath(import.meta.url)), '../../dist/sandpiper-standup');
// execSync(`node ${CLI_BIN} read -d ${testDir}`, ...)
```

The `bun x` form is recommended as the default because it is cwd-independent, layout-independent, and matches the real invocation contract.

## Acceptance
- `cd ~/git/sandpiper-ai && bun x vitest run packages/sandpiper-standup-cli/` is clean.
- `cd ~/git/sandpiper-ai && bun x vitest run` no longer shows the 37 MODULE_NOT_FOUND failures caused by this path.
- `cd ~/git/sandpiper-ai/packages/sandpiper-standup-cli && bun run test` still passes unchanged.
- `rg -n 'node dist/sandpiper-standup' packages/sandpiper-standup-cli` returns zero matches after the fix.

## Out of scope
- Switching these tests from spawning a subprocess to importing the CLI module directly. That is a larger design choice and should be done separately if at all.
- Any changes to the aux-guidance-hooks branch or the autotoon branch. This is a `main` bug.

---

# Activity Log

## 2026-04-28T18:37:46.008Z

- **description**: added (68 lines)

## 2026-05-12T16:11:57.295Z

- **status**: NOT STARTED → IN PROGRESS

## 2026-05-12T16:12:00.569Z

- **status**: IN PROGRESS → NOT STARTED

## 2026-10-27T23:08:54.717Z

- **description**: 68 lines → updated (72 lines)

## 2026-11-12T19:39:41.216Z

- **status**: NOT STARTED → COMPLETE
- **resolution**: WONTFIX
