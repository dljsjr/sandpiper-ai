# AGENT-290 Pi 1.0 migration work plan

- **Diátaxis mode**: How-to plan
- **Status**: Ready to start
- **Task**: AGENT-290
- **Related**: [migration spec](agent-290-pi-1-0-migration-spec.md), [discovery notes](agent-290-pi-1-0-discovery.md)

This plan moves Sandpiper to Pi 1.0 without breaking the Sandpiper build people run day to day, and coordinates with the `pi-claude-code-cli-provider` migration.

## Before you start

- Read the [migration spec](agent-290-pi-1-0-migration-spec.md). Each step below implements one of its sections.
- Work in a dedicated jj workspace, for example `jj workspace add ../sandpiper-ai-pi1`, so the default workspace keeps running Sandpiper on Pi 0.85.1 until AGENT-303 passes. When the work is merged, run `jj workspace forget` and remove the directory.
- Make one jj change per subtask, with `Refs: AGENT-<n>` in the description.
- Target `1.0.3`. If `1.0.4` reaches npm mid-migration, bump in its own change and rerun every gate below.

## Steps

| Step                                   | Subtask   | Depends on                  | Verify with                                                                                                                  |
| -------------------------------------- | --------- | --------------------------- | ---------------------------------------------------------------------------------------------------------------------------- |
| 1. Bump Pi pins, fix test doubles      | AGENT-293 | none                        | `bun check`; `bun run test`; `rm -rf dist && env -u PI_PACKAGE_DIR bun run test:distribution`                                |
| 2. Write prompt regression tests (red) | AGENT-294 | 1                           | The new tests fail on stock behavior for the reasons the spec's invariants name                                              |
| 3. Hybrid prompt ownership and guard   | AGENT-295 | 2                           | AGENT-294 tests pass; full suite green                                                                                       |
| 4. Tool guidelines and hidden tools    | AGENT-296 | 2                           | Guidelines block matches Pi 0.85.1 output for the same tools                                                                 |
| 5. Diagnostic renders the sent prompt  | AGENT-297 | 3                           | `sandpiper-system-prompt --approve` output equals the prompt captured by a recording provider                                |
| 6. AutoTOON nested calls               | AGENT-298 | 1                           | New AutoTOON tests; full suite green                                                                                         |
| 7. Compiled app runtime setup          | AGENT-299 | 1                           | `bun run test:standalone-app` plus a codemode check in the compiled binary, or a recorded decision to disable codemode there |
| 8. Inherited Pi 1.0 defaults           | AGENT-300 | 1                           | User decisions recorded on the task; behavior checked live                                                                   |
| 9. Build and distribution topology     | AGENT-301 | 1                           | Agreed topology; distribution gate green                                                                                     |
| 10. Docs and playbooks                 | AGENT-302 | 3                           | Consistency sweep of touched docs                                                                                            |
| 11. End-to-end dogfood                 | AGENT-303 | 3 to 10, provider migration | Checklist in AGENT-303 passes on the built runtime                                                                           |

Steps 3, 4, and 6 can run in parallel after their dependencies. Do steps 1 to 4 and 6 before anyone uses the Pi 1.0 build as a daily driver: without them, the model loses the tool guidelines and idle synthetic turns run on Pi's default prompt.

## Coordinating with the provider migration

The `pi-claude-code-cli-provider` migration runs in its own repository with its own tracker and agent.

|                     | Sandpiper lane                                                                                                            | Provider lane                                  |
| ------------------- | ------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------- |
| Owner               | The Sandpiper agent                                                                                                       | The provider agent                             |
| Workspace           | `sandpiper-ai` (dedicated workspace)                                                                                      | `pi-claude-code-cli-provider`                  |
| Touchpoints         | `extensions/system/`, `packages/core/`, `extensions/autotoon/`, manifests                                                 | The provider's stream and replay code          |
| Integration hazards | The provider-facing request shape (system messages, sections, tool deltas, guard edits) and the Pi version both sides pin | Same                                           |
| Ready artifact      | AGENT-295 and AGENT-296 landed                                                                                            | Provider passes its own tests against Pi 1.0.3 |
| Integration         | AGENT-303 runs Sandpiper with the migrated provider                                                                       | Same checkpoint                                |

Coordinate over Tattler. The contract between the lanes is the [provider-facing request shape](agent-290-pi-1-0-migration-spec.md#provider-facing-request-shape). If either lane needs to change it, agree on the change over Tattler, then update the spec before implementing.

The provider can develop against plain Pi 1.0.3 before Sandpiper's prompt work lands. The request has the same structure under plain Pi; only the sections present, their text, and the guard's dropped patches differ.

## After phase 1: adoption candidates

These were discussed but are not authorized. Each needs the user's go-ahead before it becomes a task:

- Render Sandpiper's blocks as Pi sections instead of one preamble, so changes travel as per-section updates.
- Remove the guard once upstream fixes [#5581](https://github.com/earendil-works/pi/issues/5581). The AGENT-294 tests should still pass without it.
- Declare `outputSchema` and return `structuredContent` from Sandpiper tools that return data.
- Add tool `annotations` (`readOnlyHint` and related hints) to Sandpiper tools.
- Replace `mcporter` in the web-search Parallel adapter with `pi.registerMcpServer()`.

## If something goes wrong

- Undo jj operations with `jj op log` and `jj op restore <op-id>`. Because the work happens in a separate workspace, the default workspace is unaffected.
- Sessions touched by Pi 1.0 contain `role: "system"` entries. Do not resume them with the 0.85.1 build.
- The guard depends on how Pi records system messages. Rerun the AGENT-294 tests on every Pi bump.
