---
title: "Retire Shell Relay"
status: COMPLETE
resolution: DONE
kind: TASK
priority: MEDIUM
assignee: "relay-removal"
reporter: AGENT
created_at: 2026-11-02T18:19:44.026Z
updated_at: 2026-11-23T22:05:41.363Z
related:
  - TOOLS-30
  - TOOLS-92
  - TOOLS-33
---

# Retire Shell Relay

## Delivered, awaiting review (2026-11-10)

Agent relay-removal (Fable 5.2, medium) delivered one commit from an isolated jj workspace: change yympvrno (c63b4c81) "refactor: Remove Shell Relay". It sits on the working line. The main bookmark is unchanged and root dist was not rebuilt.

Size: 81 files changed, 130 insertions, 4,441 deletions. 43 files deleted (36 under extensions/shell-relay and 7 in packages/core/src), 4 documents moved to .sandpiper/archive/shell-relay/, 34 files edited.

Removed: the extension and its workspace, Vitest project and lockfile entry; the --install-shell-integrations flag in the system extension and in core; install-shell-integrations.ts, preflight.ts, host-context.ts and paths.ts with their tests; the fish and mkfifo entries in knip.jsonc; every live document reference.

Kept: the diagnostics banner and the unmigrated-config warning (the diagnostic type moved into system-diagnostics.ts as SystemDiagnostic), the other four migration flags and /migrate-pi, the update check, and both SANDPIPER_SESSION_* variables.

Verification by the agent and repeated by the coordinator in the agent's workspace: bun check clean; bun run test 71 files / 559 tests pass (726 before: -142 extension tests, -12 installer, -1 installer case in migration-controls, -8 preflight, -4 host-context). The built --help no longer lists the flag. The coordinator's own search of live code and documents finds one remaining mention: web-fetch-prd.md line 62 compares its structure to shell-relay.

For review:
- The agent ran Prettier on the Markdown files it edited. Three of them (ast-grep/README.md, extensions/README.md and the archived extension README) were not Prettier-clean before, so they carry formatting changes beyond the edits.
- .sandpiper/skills/tui/SKILL.md lost its section on preflight duplication, which described deleted code.
- Dated specs that still mention Shell Relay were left as records: the three agent-35 specs, web-fetch-prd.md, and the files excluded by the brief.

## Decision: retire Shell Relay (2026-11-10)

Doug decided to remove Shell Relay completely: delete all relevant code, clean up the documents, archive the SHR Trail project and close adjacent tickets. This task now tracks that removal.

Scope:
- extensions/shell-relay/ (37 files, 3,757 lines; 10 test files with about 138 tests), its workspace and lockfile entry, its Vitest project entry, and the commented-out wiring in packages/cli/sandpiper_resources.ts.
- The --install-shell-integrations flag, in the system extension and in core, with packages/core/src/install-shell-integrations.ts and its test.
- The preflight registration and collection machinery in packages/core/src/preflight.ts. Its only producer was Shell Relay. The diagnostics banner and the unmigrated-config warning stay, because the migration feature (inventory row B-2) is undecided.
- packages/core/src/host-context.ts and paths.ts, which only the installer and the extension used (this also resolves inventory row A-3).
- Documents: the public feature page, the playbook, the design spec and the extension README move to .sandpiper/archive/shell-relay/. Every live document that presents Shell Relay as a feature is corrected.

Kept: SANDPIPER_SESSION_ID and SANDPIPER_SESSION_FILE (decided under TOOLS-106), the update check, the other migration flags, and the existing .sandpiper/archive/shell-relay/ history.

Tracker work done by the coordinator on 2026-11-10: SHR project archived; its nine open tasks closed WONTFIX; AGENT-47 closed WONTFIX because its only motivating case was the relay extension as a second output consumer.

Outside the repository and not changed: the fish configuration on this machine sources ~/.sandpiper/shell-integrations/relay.fish when it exists. The directory does not exist.

Execution: one implementation agent (Fable 5.2, medium) in an isolated jj workspace.

## Owner clarification: deferred capability decision, not packaging repair

Doug clarified that Shell Relay is intentionally disabled because it does not work well, and he is considering deprecating it entirely. No deprecation/removal decision is made yet.

Do not restore Shell Relay, add its assets, or repair its installer as part of build simplification. This item is deferred pending the broader keep-or-retire decision. It does not block TOOLS-30/92's build design. If retained, evaluate the installer with that capability; if retired, remove its exposed installer surface as part of an explicitly approved retirement. Do not infer approval to delete it from this clarification.

## Original observation and reproduction

The current CLI advertises --install-shell-integrations through extensions/system/migration-controls.ts. Its session_start handler calls the default core installer. packages/core/src/install-shell-integrations.ts:getSourceDir resolves PI_PACKAGE_DIR/extensions/shell-relay/shell-integration, but the current CLI tarball contains none of relay.fish/relay.bash/relay.zsh.

Reproduced during TOOLS-92: extracted the actual Bun-packed current CLI into an owned temporary directory, set PI_PACKAGE_DIR to that extracted package, then invoked the real installShellIntegrations with an explicit temporary target. It returned success:false and 'Shell integration source not found'. No real user shell integration or configuration was touched. The packed --help smoke does not test this behavior. Origin of the gap has not been dated.

Decision required: if this public flag remains supported, include its owned assets and add an isolated installed-behavior regression. If Shell Relay support is intentionally retired, remove the public surface through an explicit approved change instead. The recommended root-package prototype can ship these source assets through the package file list without a staging helper, but does not include them yet. Do not silently drop the capability or add automatic installation.

Evidence: .sandpiper/archive/build-simplification-exploration.md. No bug fix implemented.

---

# Activity Log

## 2026-11-02T18:27:57.879Z

- **kind**: BUG → TASK

## 2026-11-02T18:27:57.949Z

- **priority**: MEDIUM → LOW
- **title**: CLI shell integration installer cannot find its scripts in the packed package → Resolve the installer surface with the Shell Relay keep-or-retire decision
- **description**: 7 lines → updated (15 lines)

## 2026-11-10T16:09:43.289Z

- **priority**: LOW → MEDIUM
- **title**: Resolve the installer surface with the Shell Relay keep-or-retire decision → Retire Shell Relay
- **description**: 15 lines → updated (34 lines)

## 2026-11-10T16:09:43.424Z

- **status**: NOT STARTED → IN PROGRESS
- **assignee**: UNASSIGNED → relay-removal

## 2026-11-10T16:39:22.275Z

- **description**: 34 lines → updated (51 lines)

## 2026-11-10T16:39:22.372Z

- **status**: IN PROGRESS → NEEDS REVIEW

## 2026-11-10T16:57:02.078Z

- **status**: NEEDS REVIEW → COMPLETE
- **resolution**: DONE

## 2026-11-23T22:02:40.077Z

- **description**: updated

## 2026-11-23T22:05:41.363Z

- **description**: updated
