---
title: "Source CLI smoke cases exceed five-second limits during serial verification"
status: COMPLETE
resolution: DONE
kind: BUG
priority: MEDIUM
assignee: AGENT
reporter: AGENT
created_at: 2026-11-11T19:17:58.400Z
updated_at: 2026-11-11T21:49:42.094Z
related:
  - TOOLS-30
  - TOOLS-113
  - TOOLS-121
---

# Source CLI smoke cases exceed five-second limits during serial verification

## Closed as moot by TOOLS-126 (2026-11-11)

Doug chose to delete packages/cli/standalone_cli_smoke.test.ts because devtools/packedCli.test.ts already makes the same assertions against the installed tarball. This is a design decision, not a timing remedy: the cause of the historical 11 to 14 second tails remains unproved. The three failing cases no longer exist, and the proposed --no-install guard for the source helper is moot. The four remaining unit gates then passed; see TOOLS-126.

## Session wrap (2026-11-11)

Paused at Doug's request because of high context. All agents/processes are stopped and temporary workspaces removed. All ten original implementations are committed/reviewed; seven are NEEDS REVIEW and three remain full-gate-blocked.122 investigation did not reproduce the historical timing tails. Doug noted sustained high laptop load; plausible context, not measured cause. The three source cases use inherited5s defaults versus15s for sibling CLI cases; no documented5s startup SLA. No timeout change or permanent source-helper no-install guard was approved/applied. Do not resume without new scope/go. Continuation: .sandpiper/notes/simplification-handoff.md.

## Investigation complete; historical cause unproved (2026-11-11)

No net source/test/timeout changes. All agents are closed and clean checkouts removed.123-125 are NEEDS REVIEW. No permanent correction is authorized for this bug.

Safe direct source probes on failed113 and final source passed in0.710-1.476s with cleanup35-52ms. One focused actual-Vitest comparison passed all3 original assertions at unchanged5000ms limits:935/934/715ms. NODE_ENV=test, VITEST=true and VITEST_MODE=RUN were captured. Eager sandpiper_resources import cost~925ms; jsdom ancestry represented503/998 sampledms. An isolated cold/warm transpiler cache pair measured.754/.399s. These are measured ordinary costs, not a demonstrated historical11-14s cause.

ONE full diagnostic overlay also passed66files/541tests in103.63s. It temporarily guarded the source helper, instrumented phases, prefixed all Bun subprocesses through an external no-install shim/BUN_EXECUTABLE and BUN_OPTIONS, and isolated outer XDG cache. This is NOT an exact-commit gate. Successful-test console phase output was suppressed by the summary reporter, so individual full-run phases were not captured; no second run to repair capture. Smoke file total6.236s. No timing cause can be asserted.

Evidence: /tmp/sandpiper-source-phases-20261111/summary.json, focused-vitest-result.json, full-diagnostic-result.json, logs, profiles and restored diffs; static trace /tmp/sandpiper-tools124-source-trace-20261111.md. No global cache or real-user state changed.

No evidence warrants timeout increases, production lazy-import/cache policy changes, replacing source coverage with built-only coverage, or blaming113. The source smoke helper still allows Bun auto-install; adding its own explicit --no-install is a separately defensible test-safety correction, not a proved latency remedy. Approval is needed before keeping that test change and restarting remaining exact gates.

Corrected serial full verification passed the reference plus seven implementation units, then stopped at wvpsuuxu/18f9ae6f634d. All attempted frozen installs and bun check passed. Full suite exited1 after261.518s:65/66files,538/541tests passed. Three standalone_cli_smoke.test.ts source-entrypoint cases exceeded existing5000ms limits: line134 loads extension flags exactly once (13768ms), line140 persisted package-management settings (11556ms), line165 Pi metadata before import (12585ms). Built-bin runtime-Pi-import case passed with the approved --no-install correction. No cause attributed, no retries or timeout edits. The preceding112 unit passed66files/541tests.113 removes ast-grep/config/docs/script only; no runtime/test source changes in that unit. Do not claim a113-specific regression or assume load is the cause. Remaining consolidation and two Markdown unit full gates were not attempted; without-bunfig probe was skipped. Logs: /var/folders/zj/49vt4cds6l15fs_1frdvz89r0000gn/T/sandpiper-tools121-independent.7rb1rlik/08-wvpsuuxu/full-test.log and summary.json. Investigation is NOT STARTED and requires Doug go. No source changes for this finding.

---

# Activity Log

## 2026-11-11T19:32:25.113Z

- **status**: NOT STARTED → IN PROGRESS
- **assignee**: UNASSIGNED → AGENT

## 2026-11-11T20:03:32.291Z

- **description**: 1 line → updated (13 lines)

## 2026-11-11T20:44:25.580Z

- **description**: 13 lines → updated (17 lines)

## 2026-11-11T21:09:12.367Z

- **description**: 17 lines → updated (21 lines)

## 2026-11-11T21:09:13.630Z

- **status**: IN PROGRESS → NEEDS REVIEW

## 2026-11-11T21:49:42.095Z

- **status**: NEEDS REVIEW → COMPLETE
- **resolution**: DONE
