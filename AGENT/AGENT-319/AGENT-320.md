---
title: "Audit the Pi 1.3.0 to 1.5.0 update"
status: COMPLETE
resolution: DONE
kind: SUBTASK
priority: HIGH
assignee: "pi-audit"
reporter: USER
created_at: 2026-11-10T16:10:00.472Z
updated_at: 2026-11-23T22:02:35.685Z
---

# Audit the Pi 1.3.0 to 1.5.0 update

## Delivered, awaiting review (2026-11-10)

Agent pi-audit (Fable 5.2, medium) delivered one docs commit, change wolzontn: .sandpiper/archive/pi-1-5-update-audit.md (625 lines) and its index row. No product code changed; the trial changes were discarded.

Verdict: the update is small. Recommended target 1.5.2. Required: set the four pins and rename the patch key; carry the patch (all four hunks apply); import Type from typebox in about 12 files, because pi-ai 1.5.0 no longer re-exports it and the CLI does not start otherwise; update version literals in two tests and one stale preamble marker; update documents. With those edits the trial passed 84 files / 726 tests on 1.5.0 and on 1.5.2.

Checked by the coordinator: pi-ai 1.3.0 and 1.4.0 export Type from typebox in dist/index.d.ts; 1.5.0 and 1.5.1 do not.

Open points for Doug: target version (1.5.1 and later change the cacheWarming default to idle, which lets idle sessions send cache-refresh requests); the native version check proposal (works with one more patch hunk; the banner says to run "sandpiper update"); provider requests carry User-Agent pi/0.0.1 from 1.4.0 on; extensions outside this repository were not checked.

Audit what changes between Pi 1.3.0 and 1.5.0 (and note what 1.5.1 and 1.5.2 add) before Sandpiper updates. Deliverable: .sandpiper/archive/pi-1-5-update-audit.md, covering breaking changes, the state of the local patch against the new version, the extension and SDK API surface Sandpiper uses, environment and RPC behavior the tests rely on, dependency and size changes, Pi features that now overlap Sandpiper code, every hard-coded version pin, and the raw result of a trial version bump (type errors and test failures, no fixes).

Execution: one agent (Fable 5.2, medium) in an isolated jj workspace. The audit changes no product code.

---

# Activity Log

## 2026-11-10T16:10:00.579Z

- **status**: NOT STARTED → IN PROGRESS
- **assignee**: UNASSIGNED → pi-audit

## 2026-11-10T16:45:26.404Z

- **description**: 3 lines → updated (13 lines)

## 2026-11-10T16:45:26.480Z

- **status**: IN PROGRESS → NEEDS REVIEW

## 2026-11-10T22:20:41.009Z

- **status**: NEEDS REVIEW → COMPLETE
- **resolution**: DONE

## 2026-11-23T22:02:35.685Z

- **description**: updated
