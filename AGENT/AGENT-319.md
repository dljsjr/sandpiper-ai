---
title: "Update the Pi dependency from 1.3.0 to 1.5.2"
status: COMPLETE
resolution: DONE
kind: TASK
priority: HIGH
assignee: "pi-audit"
reporter: USER
created_at: 2026-11-10T16:09:43.550Z
updated_at: 2026-11-10T22:20:41.112Z
---

# Update the Pi dependency from 1.3.0 to 1.5.2

## Third commit delivered, awaiting review (2026-11-10)

change rmlmvspm: fix: Identify as the Pi version in Pi's User-Agent. Three more one-line patch hunks, each reading PI_CODING_AGENT_VERSION and falling back to the previous value: dist/utils/pi-user-agent.js (model catalog, version check, tool downloads, installer downloads, telemetry and bug-report User-Agent), dist/core/client-identity.js (requests to model providers), dist/extensions/mcp/runtime.js (MCP client info). The patch now has eight hunks in six files. VERSION keeps its meaning elsewhere.

Evidence from the agent: with the patched code pi.dev answers the openai-codex catalog request with 200 and 8 models including gpt-6.1-terra; unset, it answers 404. The built CLI hands providers pi/1.5.2. A behavioral test covers both User-Agent functions with and without the variable; it failed before the patch.

Verification repeated by the coordinator in the agent's workspace: bun check clean; bun run test 70 files / 552 tests.

For review: the MCP client-info hunk goes beyond User-Agents and can be dropped on its own. sandpiper update is unchanged: from a checkout it refuses and names the package to update; from a global install it would install stock Pi beside Sandpiper.

## Delivered, awaiting review (2026-11-10)

Agent pi-audit delivered two commits from its isolated workspace, now on the working line. The main bookmark is unchanged; the main checkout's node_modules and dist are not updated.

- change zuouullt: build: Update Pi to 1.5.2 (24 files). Four pins, patch carried with four hunks, Type imported from typebox in 12 files, typebox 1.3.27 declared, version literals in two tests, the redundant default-preamble assertion deleted, patch procedure in docs/dev/build-system.md hardened.
- change oqutxtqn: refactor: Use Pi's native update check (19 files, 380 lines removed). Fifth patch hunk passes PI_CODING_AGENT_VERSION to the native check; update-check.ts, the update banner, the checkForUpdates plumbing, shouldCheckForUpdates and the PI_SKIP_VERSION_CHECK line in the bootstrap are gone.

Verification by the agent and repeated by the coordinator at each commit in the agent's workspace: commit 1 bun check clean, 71 files / 559 tests; commit 2 bun check clean, 70 files / 549 tests. The installed interactive-mode.js line 873 carries the patched call.

Finding that needs a decision: pi.dev reads the client version from the User-Agent, and Sandpiper sends its own package version. The coordinator reproduced it: with pi/0.0.1 the model catalog endpoint returns 404 and latest-version returns the legacy package at 0.73.1; with pi/1.5.2 the catalog returns 200 and latest-version returns 1.5.2. So the remote model catalog never reaches Sandpiper. A one-line hunk in dist/utils/pi-user-agent.js would fix the catalog, the tool download and the version check User-Agent together. Provider requests use a different place.

For review:
- PI_SKIP_VERSION_CHECK is no longer exempt from mirroring, so SANDPIPER_SKIP_VERSION_CHECK=1 now also turns the native check off.
- The build bundles its own copy of typebox 1.3.27, the same version Pi resolves.
- Packed tarball: 28,491,145 bytes, up 846,593 from 27,644,552.
- web-search-mcp-transport-investigation.md lines 40 and 88 now say 1.5.2.

## Decisions after the audit (Doug, 2026-11-10)

- Target version: 1.5.2.
- Replace Sandpiper's own update check with Pi's native check, using one more hunk in the local patch that passes PI_CODING_AGENT_VERSION to the check. Delete packages/core/src/update-check.ts, the update banner in extensions/system/diagnostics-hooks.ts, the plumbing around them, and the PI_SKIP_VERSION_CHECK=1 that the bootstrap sets. TOOLS-87 is a bug in the deleted code and closes with it.
- Extensions outside this repository are already validated by Doug. Live interactive checks are not required.

Coordinator findings that shape the work:
- Type imports: Pi 1.5.2 still types registerTool against TypeBox (dist/core/extensions/types.d.ts imports Static and TSchema from typebox), its own built-in tools import Type from typebox, and its extension guide says to do the same. pi-schema is the validator. So the fix is to import Type from typebox.
- The default-preamble assertion in extensions/system/prompt-ownership.test.ts is redundant: the line before it already asserts that the prompt starts with Sandpiper's block. Delete it instead of pinning Pi's new wording.

Audit: .sandpiper/docs/specs/pi-1-5-update-audit.md (AGENT-320).

Doug wants the Pi dependency updated from 1.3.0 to 1.5.0 so the latest Codex models are available. On 2026-11-10 npm lists 1.3.0, 1.4.0, 1.5.0, 1.5.1 and 1.5.2 for all four @earendil-works packages that Sandpiper pins (pi-coding-agent, pi-ai, pi-tui, pi-mcp).

Sandpiper pins Pi exactly and patches pi-coding-agent locally (patches/@earendil-works%2Fpi-coding-agent@1.3.0.patch). The patch must be redone on each Pi version. Twelve tests hard-code 1.3.0.

Sequence: audit first (subtask), then the update itself after Doug reviews the audit.

---

# Activity Log

## 2026-11-10T16:57:02.249Z

- **title**: Update the Pi dependency from 1.3.0 to 1.5.0 → Update the Pi dependency from 1.3.0 to 1.5.2
- **description**: 5 lines → updated (17 lines)

## 2026-11-10T16:57:02.324Z

- **status**: NOT STARTED → IN PROGRESS
- **assignee**: UNASSIGNED → pi-audit

## 2026-11-10T17:20:50.385Z

- **description**: 17 lines → updated (34 lines)

## 2026-11-10T17:20:50.468Z

- **status**: IN PROGRESS → NEEDS REVIEW

## 2026-11-10T17:43:29.969Z

- **status**: NEEDS REVIEW → IN PROGRESS

## 2026-11-10T17:48:58.240Z

- **description**: 34 lines → updated (44 lines)

## 2026-11-10T17:48:58.308Z

- **status**: IN PROGRESS → NEEDS REVIEW

## 2026-11-10T22:20:41.112Z

- **status**: NEEDS REVIEW → COMPLETE
- **resolution**: DONE
