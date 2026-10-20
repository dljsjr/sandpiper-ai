---
title: "Audit retained build, runtime and toolchain complexity against simplification scope"
status: COMPLETE
resolution: DONE
kind: SUBTASK
priority: MEDIUM
assignee: AGENT
reporter: USER
created_at: 2026-11-02T17:42:31.696Z
related:
  - TOOLS-93
updated_at: 2026-11-11T16:41:28.979Z
---

# Audit retained build, runtime and toolchain complexity against simplification scope

## Audit complete, awaiting review (2026-11-11)

Every row of .sandpiper/docs/specs/retained-surface-inventory.md has a decision from Doug. The Decision column names the task that carries out each approved change.

Done and signed off: TOOLS-93 (Shell Relay), TOOLS-103 to TOOLS-108, TOOLS-115 (documents), AGENT-319 and AGENT-320 (Pi 1.5.2), and the local cleanup in Batch L.

Approved and not started: TOOLS-109 (DuckDuckGo adapter), TOOLS-110 (.pi migration), TOOLS-111 (one manifest, Knip in the gate, one Vitest config), TOOLS-112 (logo files, Commander guidance, standup log, test:standalone), TOOLS-113 (ast-grep), TOOLS-114 (Markdown gate). TOOLS-30 stays open until these are done.

Defects found during the review, each with its own task: AGENT-321 (prompt changes mid-session; approach not chosen), AGENT-322 (escaped tags in context notes), AGENT-323 (AutoTOON rewrites read results), WEB-22 (project settings trust). Backlog: WEB-23 (llms.txt probe).

## Inventory ready for decisions (2026-11-09)

The deliverable now exists: .sandpiper/docs/specs/retained-surface-inventory.md (Reference). It replaces the pre-implementation classifications in build-simplification-exploration.md.

Doug asked for a second repo-wide pass for missed removal and simplification candidates. Six read-only audit runs covered root toolchain/config, extensions, packages plus devtools, and documentation. The coordinator repeated the searches behind the main findings. Nothing was built, packed, installed or tested, and no product file changed.

The inventory holds 15 keep rows, 6 rows tracked by TOOLS-93/43/87, 18 no-consumer leftovers (Batch A), 15 decisions with a tradeoff (B), 12 documentation corrections (C) and 4 local-only cleanups (L). Every proposal is unapproved. Decisions are recorded in the inventory's Decision column. Approved rows become implementation work under TOOLS-30 or a new task; this ticket closes when every row has a decision.

Native MCP adoption (TOOLS-100 to 102) and the root-product build are COMPLETE and are not reopened here.

## Earlier audit history

## Native MCP audit decision resolved

User approved replacing application mcporter with standalone pi-mcp1.3.0 behind own web_search, without host MCP server-tool registration.100–102 implement and verify it in current30, now NEEDS REVIEW: main/fresh86/671, offline read-only own-tool proof, independent no-findings review.29obsolete records removed,184bundle modules vs453. Developer mise mcporter CLI remains. Earlier notes below about live application mcporter/unapproved adoption/no ticket are historical and superseded for this facet only. Broader retained-surface audit/other decisions are not automatically accepted or complete.

## Earlier verification and scope record

## Shell Relay scope clarification

Doug clarified that Shell Relay is deliberately disabled for poor behavior and is under consideration for deprecation. TOOLS-93 is now a low-priority deferred capability decision, not a packaging repair or build-design blocker. Do not add shell assets or revive its installer during build simplification. Removal remains unapproved.

## Earlier scope and exploration history

## Exploration ready for review

User requested a fresh search for the simplest possible build, especially whether devtools is needed. Results and tradeoffs are in .sandpiper/docs/specs/build-simplification-exploration.md (Explanation). No application source/manifests/build scripts changed; no implementation authorized.

Recommendation: one root product package, one direct Bun build for both entrypoints, ordinary Bun packing. This can remove Turbo, separate core emission, resources/docs staging and all three production devtools helpers (151 lines), while retaining test infrastructure and module boundaries. Root-owned docs/license/assets eliminate cross-package staging instead of moving it to new scripts. Preserve current consumer package/bin identity unless explicitly renamed.

Evidence: Bun1.4.4 direct workspace pack includes patched runtime deps even under a separate hoisted-workspace fixture; it omits a parent LICENSE and a symlinked LICENSE. npm workspace packing still omits deps. Source typecheck succeeds without core dist. Two owned prototypes pass offline --ignore-scripts installs, readonly version/help, capture-provider diagnostics without external model calls, and user-extension runtime SDK imports. Bundled root prototype: one Bun invocation, no Turbo/core emit/staging/pack wrapper,16931 entries/39788927 bytes. Direct TS source prototype: no app build,24775 entries/52872269 bytes, no first-party tests,190 dependency tests. This is feasibility evidence, not a full-regression or clean-install certification.

Live dependencies and decision candidates are classified in the note: mcporter still bundled/used, SQLite/JSDOM have real consumers, mise tools are developer tooling, Shell Relay remains dormant but public install flag exists. The concrete missing shell-asset bug is TOOLS-93. No runtime features or tools were removed. Build/pack test gap and stale compiled-binary docs in33 remain open.

Sub-agent attempt failed: no terminal multiplexer. Available Sonnet route is only claude-cli/claude-sonnet, not a verified5.5 entry. This is a solo exploration, not an independent Sonnet review. Additional validation before adoption includes fresh install declarations, Bun version policy, full tests/TUI/custom resources/package management, and packaging retained non-code assets.

## Original coverage brief

The user challenged the completeness of TOOLS-30 after the agent incorrectly claimed only overall acceptance remained. This task is a scope/coverage audit, not authorization to remove dependencies or change runtime behavior. Audit what remains, not only what earlier changes removed.

Deliverable: one concrete inventory mapping retained build/runtime/toolchain surfaces to purpose, source owner, package/bundle/output, prior discussion/decision, existing task, and keep/replace/remove/defer status. Distinguish recovered decisions, unapproved proposals, unreviewed candidates and completed work. Preserve all accepted resource outcomes and immutable closed records.

Coverage:
- Reconcile original discussions and task graph, including top-level portable packaging34, Trail extraction38, temporary bridge42/follow-up43 and Journal51. They were missed by the simplistic parent-only child count.
- Inventory runtime bundle/dependency closure and remaining package boundaries. mcporter is still a web-search dependency and contributes62 source modules to current bundles. Native Pi MCP replacement is only an unapproved adoption candidate in the Pi migration spec, with no implementation ticket. Review the need/alternatives; do not silently approve a replacement. JSDOM and native SQLite have real consumers, so do not classify them as unused merely because Knip flags CLI packaging declarations.
- Review repository toolchain versus distributed dependencies. mise.toml still declares npm:mcporter; its historical addition was user-approved for developer convenience. Current necessity/ownership needs an explicit review, not automatic deletion.
- Review retained build command layers, Turbo/cache assumptions, source/package boundaries, stage/pack wrappers, externalized/bundled dependencies and dormant capability surfaces. A green build proves correctness, not that all of these are necessary.
- Classify every candidate and record real follow-up decisions/work without turning all suggestions into implementation scope. Make deliberate deferrals visible rather than declaring them outside30 by agent fiat.

Recovered facts: vendor.txt, devtools/vendor.ts, vendor script and generated-distribution Dash generation were removed in22df897e (TOOLS-31/32/33); old vendoring1/2 were folded into30. Dash was already not bundled during the Oct19/20 triage, and user approved closing4 WONTFIX. This does NOT mean mcporter runtime use was removed. Current review33's packaging-test and stale-doc findings remain valid but are not a completeness audit.

Initial reconciliation is recorded; exhaustive retained-surface audit and user decisions are still outstanding. No product code changes authorized by this ticket.

---

# Activity Log

## 2026-11-02T17:57:00.146Z

- **status**: NOT STARTED → IN PROGRESS
- **assignee**: UNASSIGNED → AGENT

## 2026-11-02T18:19:44.207Z

- **description**: 14 lines → updated (28 lines)
- **related**: (none) → TOOLS-93

## 2026-11-02T18:19:44.391Z

- **status**: IN PROGRESS → NEEDS REVIEW

## 2026-11-02T18:27:58.207Z

- **description**: 28 lines → updated (34 lines)

## 2026-11-03T03:13:25.752Z

- **description**: 34 lines → updated (40 lines)

## 2026-11-09T20:06:58.547Z

- **status**: NEEDS REVIEW → IN PROGRESS

## 2026-11-09T20:29:48.744Z

- **status**: IN PROGRESS → NEEDS REVIEW
- **description**: 40 lines → updated (52 lines)

## 2026-11-10T15:33:37.013Z

- **status**: NEEDS REVIEW → IN PROGRESS
- **description**: 52 lines → updated (64 lines)

## 2026-11-10T22:47:35.801Z

- **description**: updated

## 2026-11-11T16:18:44.200Z

- **description**: 64 lines → updated (62 lines)

## 2026-11-11T16:18:44.684Z

- **status**: IN PROGRESS → NEEDS REVIEW

## 2026-11-11T16:41:28.980Z

- **status**: NEEDS REVIEW → COMPLETE
- **resolution**: DONE
