---
title: "Clear pre-existing bun check debt blocking the zero-warning gate"
status: COMPLETE
resolution: DONE
kind: TASK
priority: MEDIUM
assignee: "sandpiper-0.84-dev"
reporter: "sandpiper-0.84-dev"
created_at: 2026-08-06T21:07:58.542Z
updated_at: 2026-08-06T21:33:28.632Z
---

# Clear pre-existing bun check debt blocking the zero-warning gate

Baseline tree (change ywskloxr / commit bee0e075, 'chore: bump deps') fails the AGENTS.md zero-errors/zero-warnings bun check gate: 1 error / 15 warnings / 1 info across three files, verified pre-existing via throwaway jj workspace at the parent commit. Findings: extensions/tattler/index.test.ts (unused tmpdir import + 2 undeclared-env-var warnings), extensions/tattler/tattler-runtime-dir.ts (4 undeclared-env-var TMPDIR warnings), packages/sandpiper-standup-cli/src/core/parser.test.ts (1 formatting error). Matches the 'pre-existing turbo.json env-var warnings' noted in the 2026-07-01 session standup - known debt since at least July.

Scope: strictly mechanical, zero logic changes - unused import removal, env-var declarations, one biome format fix. If the env-var fix lands in turbo.json, prefer passThroughEnv/globalPassThroughEnv over env unless the variable genuinely affects build outputs (env entries feed turbo cache keys; TMPDIR varies per boot on macOS and would degrade cache hits). Verify each warning actually clears.

Why now: discovered while gating AGENT-246; a truthful green 'bun check' is impossible on this tree regardless of task scope, and amending gates to 'clean except known findings' makes every subsequent AGENT-235 increment re-litigate the exception. After this lands, the gate is strictly binary again for the whole upgrade train.

SCOPE ADDENDUM (2026-08-06, coordinator): the original 15-warning report was truncated output; the full pre-existing set additionally includes 7 undeclared-env-var warnings in devtools/rootPiPackageSmoke.test.ts (PI_PACKAGE_DIR x2, PI_SKIP_VERSION_CHECK x2), devtools/vendor.ts (GITHUB_TOKEN, GH_TOKEN), extensions/chorus.ts (USERNAME), plus 1 info-level biome.json schema-version mismatch (2.4.16 vs installed CLI 2.5.4). All folded into this task's single mechanical commit - same globalPassThroughEnv pattern plus the biome.json schema bump. Exit bar: bun check fully quiet (0 errors, 0 warnings, 0 infos), no exception lists carried forward. The schema bump must not change any lint finding; if it does, that is a judgment call, stop and escalate.

---

# Activity Log

## 2026-08-06T21:07:59.398Z

- **status**: NOT STARTED → IN PROGRESS
- **assignee**: UNASSIGNED → sandpiper-0.84-dev

## 2026-08-06T21:11:32.024Z

- **description**: 5 lines → updated (7 lines)

## 2026-08-06T21:33:28.351Z

- **status**: IN PROGRESS → NEEDS REVIEW

## 2026-08-06T21:33:28.634Z

- **status**: NEEDS REVIEW → COMPLETE
- **resolution**: DONE
