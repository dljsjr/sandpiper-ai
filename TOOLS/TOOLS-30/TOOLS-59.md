---
title: "Make built-in theme resources optional for the standalone CLI"
status: COMPLETE
resolution: DONE
kind: SUBTASK
priority: MEDIUM
assignee: AGENT
reporter: USER
created_at: 2026-10-28T14:17:40.460Z
updated_at: 2026-11-02T16:59:53.358Z
---

# Make built-in theme resources optional for the standalone CLI

## User acceptance

User explicitly approved TOOLS-59 and requested closure. Implementation is COMPLETE/DONE: all owned builtin resource directories are optional; resource-free standalone installation, stock/custom theme support and invalid explicit resource-root diagnostics are verified. Existing clean649-test/check/packaging evidence remains valid. No code changes were needed for acceptance.

## Implementation and scope history

## Implementation verified — ready for review

- Default source/installed resource trees may be absent. Bootstrap preserves the computed installed path rather than falling back to checkout resources. Explicit SANDPIPER_STANDALONE_RESOURCE_ROOT overrides must be existing directories; missing paths and files produce useful errors, while empty directories are valid.
- Staging and owned resource discovery skip all absent builtin categories. Existing/present resources and configured external paths remain supported. No new sidecar, flag, SDK/theme-engine behavior or Pi asset-root patch.
- Read-only offline installed CLI is tested after deleting its entire resources tree: --version, --help and prompt rendering work, and stock dark/light themes load through the installed Pi dependency. Isolated custom theme discovery also passes with no diagnostics, alongside custom prompts and both Trail variants.
- Theme README is retained and describes optional documentation, not a runtime requirement. No theme files were designed/archived; no archives, WIP replacement or user configuration were changed.
- Baseline87 files/645 tests passed. Individual expected RED→minimum GREEN cycles covered missing default roots, file overrides, absent theme discovery and absent source staging. Final bun check clean, full87 files/649 tests pass without unhandled errors, bun run pack:cli passes. Scoped diff self-review complete; no independent review claimed (fling unavailable outside a multiplexer).

Local revision wluruuqq/a0f7173d. VCS Watchman initialization was stalled; all snapshot/commit commands used a documented command-local fsmonitor.backend=none override. User configuration still reads watchman. No persistent VCS configuration or daemon changes.

Implementation is ready for acceptance, not final completion. TOOLS-33 remains NEEDS REVIEW and TOOLS-30 remains IN PROGRESS. Existing unrelated work remains open.

## Original scope and implementation notes

## Implementation checklist

1. Resource-free bootstrap; retain validation for invalid explicit resource-root overrides.
2. Optional owned theme paths in staging/discovery, preserving present and configured themes.
3. Hermetic stock/custom/packed regressions and current docs.

Keep all work in this existing ticket as requested. Trail cannot resolve this nested subtask as a parent for further subtasks, so no new tracking tickets were created. VCS checkpoint succeeded with command-local --config fsmonitor.backend=none; current changes are only this work's Journal entry. User fsmonitor.backend remains watchman; no persistent VCS config changes.

## Approved implementation scope — 2026-11-02

User changed this existing ticket from theme-content review to making built-in resources optional. Permit a valid standalone install with no resources tree; skip absent owned theme paths in staging/discovery; preserve stock Pi asset resolution and custom theme loading. Explicit resource-root overrides must still reject invalid directories. Keep the README-only theme location as documentation; deleting it is not necessary for optional behavior and was not part of the user's latest approval. No theme design, engine rewrite, archive installation or unrelated updater fix.

Initial repo checkpoint found normal jj status stuck in Watchman initialization. Cached status reports clean but is insufficient for edits; investigate a per-command fsmonitor bypass without changing user VCS configuration before touching source.

## Earlier review scope

Review packages/resources/themes, currently a README-only scaffold, and its role in resource discovery/staging. Record the user's decision about retaining or changing this surface. Apply and verify any approved change, including portable packaging where relevant, before requesting acceptance. Do not remove the scaffold merely because it currently contains no theme files.

---

# Activity Log

## 2026-11-02T16:39:19.103Z

- **status**: NOT STARTED → IN PROGRESS
- **assignee**: UNASSIGNED → AGENT

## 2026-11-02T16:40:28.663Z

- **description**: 1 line → updated (9 lines)

## 2026-11-02T16:41:50.973Z

- **title**: Review and resolve the themes resource scaffold → Make built-in theme resources optional for the standalone CLI

## 2026-11-02T16:43:31.800Z

- **description**: 9 lines → updated (17 lines)

## 2026-11-02T16:57:37.394Z

- **description**: 17 lines → updated (31 lines)

## 2026-11-02T16:57:37.588Z

- **status**: IN PROGRESS → NEEDS REVIEW

## 2026-11-02T16:59:53.291Z

- **description**: 31 lines → updated (37 lines)

## 2026-11-02T16:59:53.358Z

- **status**: NEEDS REVIEW → COMPLETE
- **resolution**: DONE
