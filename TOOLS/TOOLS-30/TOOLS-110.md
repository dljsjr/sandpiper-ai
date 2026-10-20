---
title: "Retire the .pi to .sandpiper migration"
status: COMPLETE
resolution: DONE
kind: SUBTASK
priority: MEDIUM
assignee: AGENT
reporter: USER
created_at: 2026-11-10T23:39:42.740Z
updated_at: 2026-11-11T21:49:42.227Z
related:
  - TOOLS-92
---

# Retire the .pi to .sandpiper migration

## Corrected hermetic full gate passed (2026-11-11)

With the approved mwqvznwo smoke guard inherited, independent frozen install, zero-warning check and unfiltered full suite passed: 66 files/541 tests. Actual offline/read-only packed CLI checks included. Exact command: bun run test --maxWorkers 1 --no-file-parallelism. No timeout changes or retries. Status NEEDS REVIEW, not accepted. Logs: /var/folders/zj/49vt4cds6l15fs_1frdvz89r0000gn/T/sandpiper-tools121-independent.7rb1rlik/06-wtvvzmpy/.

## Full verification passed (2026-11-11)

wtvvzmpy: independent frozen install, zero-warning bun check, and full `bun run test --maxWorkers 1 --no-file-parallelism` passed: 66 files / 541 tests. No filters, exclusions or timeout changes; real offline/read-only packed CLI checks included. Fresh start load was below8. Independent code review found no outstanding actionable findings. Status is NEEDS REVIEW, not user-accepted COMPLETE. Logs: /tmp/sandpiper-gate-last-seven-full.ARdI8S/wtvvzmpy/. Earlier implementation checkpoints below preceded this full gate.

## Independent check checkpoint (2026-11-11)

Parent/gate independently passed frozen install and the revision-specific bun check with zero errors/warnings. All ten tasks are implemented and independently reviewed with no outstanding actionable findings. Full/per-commit full-test gates remain pending quiet load; no completion or acceptance is claimed.

## Implementation checkpoint (2026-11-11)

Change wtvvzmpy removes migration/diagnostic modules, wiring, flags/command, tests and obsolete helpers. Worker clean check/build passed; focused wiring passed 7 tests. Independent review and live-reference searches found no actionable issue. Heavy CLI/packed tests and full/per-commit gates remain deferred under severe machine load; existing timeout failures are recorded, not waived.

Status remains IN PROGRESS. This checkpoint is not verified completion or user acceptance.

## Decision

Doug approved retiring the .pi to .sandpiper migration on 2026-11-10 (TOOLS-92 review, inventory row B-2). Not started.

## Facts

- 549 source and 454 test lines in five modules: packages/core/src/migrate-pi-configs.ts (227), packages/core/src/migration-controls.ts (154), packages/core/src/system-diagnostics.ts (59), extensions/system/migration-controls.ts (68), extensions/system/diagnostics-hooks.ts (41), with their tests.
- Surface: the flags --migrate-pi-configs, --symlink-config, --pi-configs-global and --pi-configs-local, the /migrate-pi command, the unmigrated-config warning at session start, and the diagnostics banner. After the Shell Relay removal and the native update check, that warning is the banner's only producer, so the banner and the SystemDiagnostic type go too.
- No user document mentions the feature. On Doug's machine both ~/.pi/agent and ~/.sandpiper/agent exist, so the warning cannot fire.

## Scope

- Remove the five modules, their tests, their exports in packages/core/src/index.ts and their wiring in extensions/system/extension-factories.ts.
- Update the tests that assert the flags in --help or in the registered flag list: extensions/system/extension-factories.test.ts, packages/cli/sandpiper_resources.test.ts, packages/cli/standalone_cli_smoke.test.ts, devtools/packedCli.test.ts.
- Correct packages/core/README.md and any other live document that names the modules.

A machine that has only ~/.pi then gets no warning and no migrate command. The directory can be moved by hand.

---

# Activity Log

## 2026-11-11T17:03:40.098Z

- **status**: NOT STARTED → IN PROGRESS
- **assignee**: UNASSIGNED → AGENT

## 2026-11-11T17:32:18.545Z

- **description**: 17 lines → updated (23 lines)

## 2026-11-11T17:58:20.391Z

- **description**: 23 lines → updated (27 lines)

## 2026-11-11T18:14:48.447Z

- **status**: IN PROGRESS → NEEDS REVIEW

## 2026-11-11T18:15:17.509Z

- **description**: 27 lines → updated (31 lines)

## 2026-11-11T19:21:12.701Z

- **description**: 31 lines → updated (35 lines)

## 2026-11-11T21:49:42.228Z

- **status**: NEEDS REVIEW → COMPLETE
- **resolution**: DONE
