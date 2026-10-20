---
title: "Runtime Pi import smoke test times out on a quiet machine"
status: COMPLETE
resolution: DONE
kind: BUG
priority: MEDIUM
assignee: AGENT
reporter: AGENT
created_at: 2026-11-11T18:19:02.833Z
updated_at: 2026-11-11T21:49:41.756Z
related:
  - TOOLS-30
  - TOOLS-112
---

# Runtime Pi import smoke test times out on a quiet machine

## Final corrected queue checkpoint (2026-11-11)

Corrected reference and seven implementation units passed full gates; the ninth run stopped at TOOLS-113 with three different existing5-second source-entrypoint smoke timeouts. The guarded runtime-import case did not fail. No retry, new source change or cause attribution followed. TOOLS-122 records the new blocker. Consolidation and two Markdown unit full gates and without-bunfig probe remain unattempted. Full logs: /var/folders/zj/49vt4cds6l15fs_1frdvz89r0000gn/T/sandpiper-tools121-independent.7rb1rlik; summary.json contains exact results. All agents/processes are stopped and checkouts removed.

The one-line test-only fix itself is independently verified: corrected reference69files/532tests passed, and guarded runtime-import case passed in all nine full runs. This fix is NEEDS REVIEW, not blocked by a newly attributed import defect. TOOLS-121 moved underTOOLS-30 and is blocked byTOOLS-122.

## Investigation complete, correction not yet authorized (2026-11-11)

Collected consolidated fling_done reports and closed both agents; their clean checkouts were removed. No product/test/timeout changes.

Verified mechanism: the /tmp extension has no ancestor node_modules. Pi/jiti tries native Bun import before applying host aliases. Bun auto-installs and executes a second published Pi graph; PI_OFFLINE does not disable Bun runtime auto-install. Fresh fixture cache and recursive cleanup make the smoke test non-hermetic.

Measured exact fixture: child3.068s, cleanup1.631s,17,946entries/137.6MB. CPU profile shows60 executed fixture-cache module URLs including a second Pi1.5.2 config.js. Diagnostic --no-install preserves the marker via host-alias fallback: child1.686s, cleanup53.95ms, no downloaded package graph (675transpiler/cache entries). Independent fake-package/alias probe confirms native import bypass and fast alias fallback. Historical37.55s/15.42s tails were not phase-profiled; exact latency split remains unknown. Actual installed jiti is2.7.0 despite its2.6.1 debug banner; no observed version mismatch is claimed.

Smallest proposed test-only correction: insert --no-install before the built bin path in runSandpiperBin in packages/cli/standalone_cli_smoke.test.ts:46. Preserve the actual bin, fixture location, runtime Pi import,15s timeout and no retries. Requires user approval because current scope was investigation. Then rerun focused and remaining full gates.

Do not change production launcher, global bunfig or Pi loader for this narrow correction. The corresponding production native-first host-alias bypass is an upstream Pi/jiti integration finding, recorded here; no upstream task/issue created. Do not claim packedCli downloaded: its installed consumer has node_modules and was not measured as tainted.

Evidence: /tmp/sandpiper-import-timing-20261111/ (phase-summary.json, final-exact.*, final-profile.*, CPU profiles, final-noinstall.*, final-focused.log); /tmp/sandpiper-import-trace-probe/ (independent safe no-install alias probe); /tmp/sandpiper-import-trace-jiti.cjs (read-only expanded implementation). Full reports are in this session's agent results. No more network-capable probes are needed.

## Observed failure

packages/cli/standalone_cli_smoke.test.ts:89, loads a user extension with a runtime Pi import through the built sandpiper bin, can exceed its existing 15000 ms limit on a quiet machine.

During TOOLS-30 verification, rlkqszyn /6db38e71 full suite started at one-minute load4.89 and ended4.35. The case took37550ms:65files/540tests passed and1file/1test failed out of66files/541tests. All prior six implementation full gates passed, as did the original69file/532test baseline.

Controlled comparison, unchanged test/timeouts and identical relevant runtime source:
- rlkqszyn focused case passed in5713ms at startload2.90.
- Its already-full-gated predecessor wtvvzmpy /d72fecf3 failed the same focused case in15420ms at startload2.83 (post3.72).
- Both frozen installs and builds passed. The112 removals change no relevant runtime code, build command, dependency or patch version.

This establishes nondeterministic timing on the predecessor, not a defect specific to112. Root cause is unknown. The original baseline was not subjected to this focused comparison, so do not claim the timeout predates all current work.

## Reproduction command

After an isolated frozen install and build:

bun run test:vitest packages/cli/standalone_cli_smoke.test.ts --testNamePattern 'loads a user extension with a runtime Pi import through the built sandpiper bin' --maxWorkers 1 --no-file-parallelism --reporter verbose

The existing test uses synchronous execFileSync without a child timeout and removes its temporary fixture in finally. Distinguish child startup/import time from fixture cleanup before changing anything. Fixtures must not touch real user configuration or installed state. Do not increase timeouts or add blind retries.

## Evidence and boundary

Full failure: /tmp/sandpiper-gate-last-seven-full.ARdI8S/rlkqszyn/full-test.log
Controlled comparison: /tmp/sandpiper-gate-rlk-diagnosis.S0st6c/ (both commands, output, loads, dependency comparisons and empty exact-source diff).

Implementation of the ten approved tasks is committed and reviewed. Six are NEEDS REVIEW after full gates. TOOLS-112 and the later113/111/114 units await verification. No code is changed for this finding. Investigation of this separate blocker requires Doug's go; task remains NOT STARTED.

---

# Activity Log

## 2026-11-11T18:25:03.030Z

- **status**: NOT STARTED → IN PROGRESS
- **assignee**: UNASSIGNED → AGENT

## 2026-11-11T18:38:41.160Z

- **description**: 27 lines → updated (41 lines)

## 2026-11-11T19:17:58.993Z

- **status**: IN PROGRESS → NEEDS REVIEW

## 2026-11-11T19:21:13.015Z

- **description**: 41 lines → updated (47 lines)

## 2026-11-11T21:49:41.756Z

- **status**: NEEDS REVIEW → COMPLETE
- **resolution**: DONE
