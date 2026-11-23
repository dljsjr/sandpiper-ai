---
title: "Simplify the build and distribution system after the Pi 1.0 migration"
status: COMPLETE
resolution: DONE
kind: TASK
priority: MEDIUM
assignee: AGENT
reporter: USER
created_at: 2026-10-06T20:03:05.349Z

related:
  - TOOLS-1
  - TOOLS-2
  - AGENT-318
  - TOOLS-34
  - TOOLS-38
  - TOOLS-42
  - TOOLS-43
  - TOOLS-51
  - TOOLS-93

blocked_by:
  - TOOLS-122
updated_at: 2026-11-23T22:02:37.234Z
---

# Simplify the build and distribution system after the Pi 1.0 migration

## Session wrap (2026-11-11)

Paused at Doug's request because of high context. All agents/processes are stopped and temporary workspaces removed. All ten original implementations are committed/reviewed; seven are NEEDS REVIEW and three remain full-gate-blocked.122 investigation did not reproduce the historical timing tails. Doug noted sustained high laptop load; plausible context, not measured cause. The three source cases use inherited5s defaults versus15s for sibling CLI cases; no documented5s startup SLA. No timeout change or permanent source-helper no-install guard was approved/applied. Do not resume without new scope/go.

## Current delivery and verification checkpoint (2026-11-11)

All ten approved implementations and the separate one-line hermetic smoke correction are committed and independently reviewed. Corrected reference69/532 and seven original task full gates passed. Seven original tasks are NEEDS REVIEW. TOOLS-113 then stopped the serial queue with three existing5-second source-CLI timeouts, root cause unassigned. Consolidation and both Markdown full gates were not attempted. TOOLS-113/111/114 remain IN PROGRESS. TOOLS-116 correction is NEEDS REVIEW; broader verification121 now belongs under this parent and is blocked by new NOT STARTED bug122. No timeout/source workaround or blind retry. All agents/checkouts/processes closed. Main bookmark/live installation unchanged.

## Verification stopped at TOOLS-116 (2026-11-11)

All ten approved implementations are committed and independently reviewed. Six tasks passed full per-commit gates and are NEEDS REVIEW. This task remains IN PROGRESS, not accepted. TOOLS-112 full gate hit the runtime-Pi-import smoke timeout at load below5. Controlled comparison passed that case on112 but reproduced it on the already-full-gated110 predecessor at load2.83. Relevant source/dependencies are identical; root cause is unknown, not a proven112 regression. No source or timeout was changed for the failure.113/111/114 full gates remain unattempted. TOOLS-116 holds exact evidence and is NOT STARTED pending Doug's go for broader diagnosis. Work is at rest.

## Native MCP adoption implemented in current simplification

Native implementation is committed as a60efe94; no coding action or worker remains queued. This is a documentation-only handoff, not acceptance or new scope.

User explicitly required adoption, and100–102 are now NEEDS REVIEW after completed implementation, main/fresh86files671tests, zero-warning checks/pack, actual offline read-only OWN web_search MCP proof and independent review with no outstanding findings.29obsolete lock records removed with no retained pin changes; application bundle184modules vs453. Own tool boundary remains, server tools unregistered, developer mise mcporter CLI intact. This is not another postponed investigation.99research remains accepted DONE. Parent stays IN PROGRESS and other implementation acceptance/deferrals remain separate. No pushes/releases or main move.

## Earlier verification and scope record

## Native MCP client adoption is now in scope

Doug explicitly approved replacing the internal mcporter application library with Pi standalone MCP client as part of current overall simplification, with no deferral. TOOLS-100 adapter,101dependency closure,102verification/independent review track implementation under this parent. Own web_search facade remains unchanged and upstream tools stay unregistered. Keep developer mise mcporter CLI and all other deferrals unchanged. No parent closure or automatic implementation acceptance.

## Earlier implementation and scope history

## Approved minimal-build implementation is ready for review

TOOLS-94–98 and TOOLS-33 are NEEDS REVIEW, not DONE. Root product/one Bun build/direct packing is implemented, current normal and clean-source gates pass85files/653tests, actual offline npm/read-only runtime/native probes pass, preservation holds, and independent inherited-model review found no outstanding actionable findings. See the work plan and98 for evidence/limits. This parent remains IN PROGRESS: implementation verification is not overall user acceptance. Accepted resource tasks57/58/59 stay COMPLETE/DONE;92 remains NEEDS REVIEW. Deferred Shell Relay93, Trail43, updater87 and unapproved runtime/toolchain decisions were not silently completed. No push or release.

## Earlier scope and implementation history

## Work breakdown complete; implementation not started

TOOLS-94 package/build,95 runtime,96 tests/helper removal,97 docs and98 integrated verification/review are all NOT STARTED. Detailed contracts, ownership and dependencies: .sandpiper/archive/build-simplification-work-plan.md. Preserve existing consumer name and packages/cli/bin launcher paths. Initial parallel lanes are94/95/97, then96 after94/95, then98 after all four.

Doug paused sub-agents because he is fixing a fling bug. No worker was launched or queued, no implementation was substituted, and no product code changed. No launch retries during the hold. This parent remains open; planning completion is not implementation acceptance.

## Earlier planning and scope history

## Approved implementation breakdown

User requested a work breakdown and sub-agent implementation of the recommended root-product-package/one-Bun-build target. The no-build TypeScript alternative is not selected. Work items: TOOLS-94 package/build, TOOLS-95 runtime loader, TOOLS-96 packaging regressions/helper removal, TOOLS-97 docs/legacy build guidance, TOOLS-98 integrated verification and independent review. Package/runtime/docs are initial parallel lanes; packaging tests follow runtime+package handoff; final verification follows all four. Preserve existing consumer package and launcher paths. Shell Relay93 remains deferred.

## Earlier exploration and scope history

## Shell Relay scope clarification

Doug clarified that Shell Relay is deliberately disabled for poor behavior and is under consideration for deprecation. TOOLS-93 is now a low-priority deferred capability decision, not a packaging repair or build-design blocker. Do not add shell assets or revive its installer during build simplification. Removal remains unapproved.

## Earlier scope and exploration history

## Current exploration checkpoint

User requested a fresh build-minimization exploration. TOOLS-92 is ready for review, with an evidence-backed root-product-package proposal in .sandpiper/archive/build-simplification-exploration.md. One direct Bun build plus standard packing can eliminate custom production devtools helpers, Turbo, core emission and staging. A no-build TypeScript package also works in smoke probes but increases the tarball from about39.8MB to52.9MB. These are proposals, not approved implementation.

A real retained-asset gap is tracked by TOOLS-93: the advertised shell-integration installer cannot find scripts in the current tarball. Existing review findings33 remain open. Keep this parent IN PROGRESS. Accepted resource decisions57–59 remain DONE. No closed records or application source changed.

## Earlier scope and implementation history

## Current coverage correction — broader simplification is still open

User correctly challenged the claim that only overall signoff remains. Completed artifact/resource work is not evidence that every retained build/runtime/toolchain surface was audited. The last integrated review validated implemented changes and preservation, not completeness against the broader simplification goal. Withdraw the only-acceptance-remains claim.

TOOLS-92 now tracks the missing retained-surface audit and discussion-to-task reconciliation. mcporter runtime code is still bundled (62 source-map modules) and its mise tool remains; the Pi-native replacement was parked as an unapproved adoption candidate, not an implementation task. Vendor machinery really was removed in22df897e; Dash was already no longer bundled during the earlier triage. Do not conflate these three facts.

Related top-level packaging/extraction tickets34/38/42/43/51 are now explicitly linked here; parent-only child counts were not a complete work inventory. Deliberate deferrals and new removal decisions need explicit classification. No removal of live runtime behavior or independently installed tools is authorized merely by this audit.

Keep this parent IN PROGRESS. Accepted57/58/59 remain COMPLETE/DONE. Closed historical records are unchanged.33's two review findings remain open, but they are not the whole remaining scope.

## Earlier scope and implementation history

## Current scope and status correction — 2026-10-28

The broad build/packaging simplification is NOT complete. The user requested a review of what belongs in packages/resources, then the conversation focused on tasks/Trail and standup/Journal. The remaining resource decisions were never added to this task breakdown. The lead prematurely closed this parent and TOOLS-33 during bookkeeping by treating historical implementation notes and passing tests as sufficient acceptance. The bookkeeping acceptance recorded below does not approve the remaining resources or complete the overall work.

Complete the remaining skills, prompt-template and themes review; record the user's keep/remove/extract decisions; implement any approved changes; verify the integrated build, resource discovery and portable package; then obtain user acceptance. Do not assume that any particular resource must stay, move or be removed. Build-command consolidation was only an agent suggestion, not agreed scope. TOOLS-43 still tracks final external Trail integration separately. Earlier completed extraction milestones and their evidence are preserved.

## Earlier scope and verification history

Current boundary (TOOLS-51): the prior build simplification below is a historical review record. Its instruction to retain the bundled standup helper is superseded by the user-approved Journal cutover. Do not restore that helper or its skill/build wiring. Task status and original verification history remain unchanged.

## Prior approved scope (historical)

Retain only Sandpiper's workspace runtime and local helper builds. Keep sandpiper, sandpiper-system-prompt, Trail, standup, the local Pi patch, extensions/resources, and current configuration behavior. Keep builds explicit and package-owned output beside its package.

Remove the unused neutral Pi package, generated npm/Pi package assembly, compiled Bun app, Claude plugin, and broken vendoring updater. Keep checked-in third-party skill snapshots and licenses.

The audit and approved topology are recorded in TOOLS-31 and TOOLS-32. The superseded AGENT-301 proposal is archived at .sandpiper/archive/agent-301-build-topology-proposal.md. Implementation and verification are recorded in TOOLS-33.

## Bookkeeping acceptance — 2026-10-27

Accepted the delivered build-topology and resource simplification. TOOLS-34 subsequently approved portable CLI packing; TOOLS-38/42 extracted Trail and retained its temporary external skill bridge; TOOLS-51 replaced bundled standup with standalone Journal. Those approved changes supersede the earlier helper-retention constraints, not the original completion evidence.

Current verification: bun check passed with zero errors/warnings; bun run test rebuilt package output and passed 87 files / 640 tests, including packed-install, cache-restoration and temporary Trail bridge regressions. Closure requested during the return to build/packaging simplification. Original historical verification is retained above.

Local tracker limitation encountered during this repair: changing status retained the old DONE resolution, while --resolution with an empty value was a no-op. Used the documented exceptional storage-recovery path to remove only the two invalid resolution fields, then rebuilt the index. No standalone Trail implementation was changed.

---

# Activity Log

## 2026-10-06T20:04:35.002Z

- **description**: 8 lines → updated (12 lines)

## 2026-10-06T20:39:14.945Z

- **description**: updated

## 2026-10-20T01:28:54.901Z

- **description**: 12 lines → updated (14 lines)

## 2026-10-20T01:28:55.202Z

- **related**: (none) → TOOLS-1, TOOLS-2, AGENT-318

## 2026-10-20T15:20:02.772Z

- **status**: NOT STARTED → IN PROGRESS
- **assignee**: UNASSIGNED → AGENT

## 2026-10-20T16:38:59.603Z

- **status**: IN PROGRESS → NEEDS REVIEW

## 2026-10-20T16:39:13.790Z

- **description**: 14 lines → updated (5 lines)

## 2026-10-20T17:25:23.696Z

- **status**: NEEDS REVIEW → IN PROGRESS

## 2026-10-20T17:31:04.079Z

- **status**: IN PROGRESS → NEEDS REVIEW

## 2026-10-27T23:09:15.238Z

- **description**: 5 lines → updated (9 lines)

## 2026-10-28T01:17:04.173Z

- **description**: 9 lines → updated (15 lines)

## 2026-10-28T01:17:04.240Z

- **status**: NEEDS REVIEW → COMPLETE
- **resolution**: DONE

## 2026-10-28T14:17:40.131Z

- **status**: COMPLETE → IN PROGRESS
- **description**: 15 lines → updated (23 lines)

## 2026-10-28T14:20:52.469Z

- **description**: 23 lines → updated (25 lines)

## 2026-11-02T17:42:31.859Z

- **description**: 25 lines → updated (37 lines)
- **related**: TOOLS-1, TOOLS-2, AGENT-318 → TOOLS-1, TOOLS-2, AGENT-318, TOOLS-34, TOOLS-38, TOOLS-42, TOOLS-43, TOOLS-51

## 2026-11-02T18:19:44.325Z

- **description**: 37 lines → updated (45 lines)
- **related**: TOOLS-1, TOOLS-2, AGENT-318, TOOLS-34, TOOLS-38, TOOLS-42, TOOLS-43, TOOLS-51 → TOOLS-1, TOOLS-2, AGENT-318, TOOLS-34, TOOLS-38, TOOLS-42, TOOLS-43, TOOLS-51, TOOLS-93

## 2026-11-02T18:27:58.080Z

- **description**: 45 lines → updated (51 lines)

## 2026-11-02T18:35:59.084Z

- **description**: 51 lines → updated (57 lines)

## 2026-11-02T18:39:05.167Z

- **description**: 57 lines → updated (65 lines)

## 2026-11-02T22:18:42.601Z

- **description**: 65 lines → updated (71 lines)

## 2026-11-03T01:50:56.371Z

- **description**: 71 lines → updated (77 lines)

## 2026-11-03T03:13:25.636Z

- **description**: 77 lines → updated (83 lines)

## 2026-11-09T16:53:08.535Z

- **description**: 83 lines → updated (85 lines)

## 2026-11-11T18:20:22.452Z

- **blocked_by**: (none) → TOOLS-116

## 2026-11-11T18:20:22.776Z

- **description**: 85 lines → updated (89 lines)

## 2026-11-11T19:17:58.711Z

- **blocked_by**: TOOLS-116 → TOOLS-122

## 2026-11-11T19:21:48.540Z

- **description**: 89 lines → updated (93 lines)

## 2026-11-11T20:44:25.431Z

- **description**: 93 lines → updated (97 lines)

## 2026-11-11T21:59:08.315Z

- **status**: IN PROGRESS → NEEDS REVIEW

## 2026-11-11T21:59:08.590Z

- **status**: NEEDS REVIEW → COMPLETE
- **resolution**: DONE

## 2026-11-23T22:02:37.234Z

- **description**: updated
