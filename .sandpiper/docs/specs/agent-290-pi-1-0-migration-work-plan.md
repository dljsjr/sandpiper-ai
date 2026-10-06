# AGENT-290 Pi 1.0 migration work plan

- **Diátaxis mode**: How-to plan
- **Status**: Ready to start
- **Task**: AGENT-290
- **Related**: [migration spec](agent-290-pi-1-0-migration-spec.md), [discovery notes](agent-290-pi-1-0-discovery.md)

This plan moves Sandpiper to Pi 1.0 without breaking the Sandpiper build people run day to day, and coordinates with the `pi-claude-code-cli-provider` migration.

## Before you start

- Read the [migration spec](agent-290-pi-1-0-migration-spec.md). Each step below implements one of its sections.
- Work in a dedicated jj workspace, for example `jj workspace add ../sandpiper-ai-pi1`, so the default workspace keeps running Sandpiper on Pi 0.85.1 until the end-to-end check in step 10 passes. When the work is merged, run `jj workspace forget` and remove the directory.
- Make one jj change per subtask, with `Refs: AGENT-<n>` in the description.
- Tests are part of the subtask they verify. Write them first, red on stock behavior, in the same change.
- Target `1.0.4`. If a later 1.0.x reaches npm mid-migration, bump in its own change and rerun every gate below.

## Steps

| Step                                     | Subtask   | Depends on                 | Verify with                                                                                                      |
| ---------------------------------------- | --------- | -------------------------- | ---------------------------------------------------------------------------------------------------------------- |
| 1. Bump Pi pins, fix test doubles        | AGENT-293 | none                       | `bun check`; `bun run test`; `rm -rf dist && env -u PI_PACKAGE_DIR bun run test:distribution`                    |
| 2. Prompt ownership and Shape B Pi patch | AGENT-295 | 1                          | Its prompt regression tests fail on stock Pi, then pass; full suite green                                        |
| 3. Pi tool sections under Sandpiper      | AGENT-296 | 2                          | Its tests show Pi's `rules` carries the 0.85.1 guidelines and both sections track tool changes; full suite green |
| 4. Diagnostic renders the sent prompt    | AGENT-297 | 2                          | `sandpiper-system-prompt --approve` output equals the prompt captured by a recording provider                    |
| 5. AutoTOON nested calls                 | AGENT-298 | 1                          | New AutoTOON tests; full suite green                                                                             |
| 6. Compiled app runtime setup            | AGENT-299 | 1                          | `bun run test:standalone-app` with OAuth and Bedrock setup checked in the compiled binary                        |
| 7. Inherited Pi 1.0 defaults             | AGENT-300 | 1                          | User decisions recorded on the task; behavior checked live                                                       |
| 8. Build and distribution topology       | AGENT-301 | 1                          | Agreed topology; distribution gate green                                                                         |
| 9. Docs and playbooks                    | AGENT-302 | 2                          | Consistency sweep of touched docs                                                                                |
| 10. End-to-end check                     | AGENT-290 | 1 to 9, provider migration | The done criteria in AGENT-290 pass on the built runtime                                                         |

Steps 2 and 5 can run in parallel after step 1. Step 3 follows step 2 because both change the same patch file. Do steps 1 to 3 and 5 before anyone uses the Pi 1.0 build as a daily driver: without them, the model loses the tool guidelines and idle synthetic turns run on Pi's default prompt.

## Coordinating with the provider migration

The `pi-claude-code-cli-provider` migration runs in its own repository with its own tracker and agent.

|                     | Sandpiper lane                                                                                               | Provider lane                                  |
| ------------------- | ------------------------------------------------------------------------------------------------------------ | ---------------------------------------------- |
| Owner               | The Sandpiper agent                                                                                          | The provider agent                             |
| Workspace           | `sandpiper-ai` (dedicated workspace)                                                                         | `pi-claude-code-cli-provider`                  |
| Touchpoints         | `extensions/system/`, `packages/core/`, `extensions/autotoon/`, manifests                                    | The provider's stream and replay code          |
| Integration hazards | The provider-facing request shape (system messages, sections, tool deltas) and the Pi version both sides pin | Same                                           |
| Ready artifact      | AGENT-295 and AGENT-296 landed                                                                               | Provider passes its own tests against Pi 1.0.4 |
| Integration         | AGENT-290's end-to-end check runs Sandpiper with the migrated provider                                       | Same checkpoint                                |

Coordinate over Tattler. The contract between the lanes is the [provider-facing request shape](agent-290-pi-1-0-migration-spec.md#provider-facing-request-shape). If either lane needs to change it, agree on the change over Tattler, then update the spec before implementing.

The provider can develop against plain Pi 1.0.4 before Sandpiper's prompt work lands. The request has the same structure under plain Pi; only the sections present and their text differ.

## After phase 1: adoption candidates

These were discussed but are not authorized. Each needs the user's go-ahead before it becomes a task:

- Render Sandpiper's blocks as Pi sections instead of one preamble, so changes travel as per-section updates.
- Remove the synthetic-runs part of the local Pi patch once upstream fixes [#5581](https://github.com/earendil-works/pi/issues/5581). The prompt regression tests from AGENT-295 should still pass without it.
- Declare `outputSchema` and return `structuredContent` from Sandpiper tools that return data.
- Add tool `annotations` (`readOnlyHint` and related hints) to Sandpiper tools.
- Register rarely used Sandpiper tools with `exposure: "deferred"` and enable `tool_search`, so their snippets and guidelines leave the `tools` and `rules` sections until the model loads them. Under `pi-claude-code-cli-provider`, a tool loaded mid-run is not callable until the Claude Code turn ends (PCCP-304 tracks the fix), so wait for that before adopting.
- Register turn-control tools (`done`, `tattler_receive`) with `exposure: "model-only"` if codemode scripts calling them becomes a measured problem: calls from scripts ignore `terminate`.
- Replace `mcporter` in the web-search Parallel adapter with `pi.registerMcpServer()`.

## If something goes wrong

- Undo jj operations with `jj op log` and `jj op restore <op-id>`. Because the work happens in a separate workspace, the default workspace is unaffected.
- Sessions touched by Pi 1.0 contain `role: "system"` entries. Do not resume them with the 0.85.1 build.
- The local Pi patch targets compiled Pi output (`patches/` via `bun patch`). Redo it and rerun the prompt regression tests on every Pi bump.
