---
title: "Fix test failures uncovered during today's session"
status: COMPLETE
resolution: DONE
kind: BUG
priority: MEDIUM
assignee: UNASSIGNED
reporter: USER
created_at: 2026-07-11T01:30:20.991Z
updated_at: 2026-07-11T01:30:47.935Z
---

# Fix test failures uncovered during today's session

Fixed several pre-existing test failures, some surfaced by today's other work, some independently pre-existing:

1. packages/cli/sandpiper_resources.test.ts and packages/cli/standalone_bootstrap.test.ts asserted shell_relay tool presence / a bundled shell-integration symlink -- both stale since shell-relay was deliberately (if temporarily) disabled in df04a14d. Updated to assert its absence instead of restoring it.

2. Fixing #1 exposed a real test-isolation bug: sandpiper_resources.test.ts's remaining assertion imported the real, unmocked web-search extension, whose adapter-selection resolves the Brave API key via readSettingsKey -- reading this developer's actual ~/.sandpiper/agent/settings.json, which configures the key via a shell-out command ('op read op://Personal/.../credential', i.e. the 1Password CLI), causing an unbounded wait for manual approval. extensions/web-search/src/adapter-selection.test.ts already has the correct pattern for this (mock readSettingsKey); applied the same vi.mock to sandpiper_resources.test.ts so it never touches real user config or invokes 1Password.

3. packages/cli/standalone_cli_smoke.test.ts and devtools/standaloneSandpiperAppCompile.test.ts asserted a 'using pi-coding-agent version:' startup line that was intentionally commented out in the same df04a14d commit -- confirmed intentional (Doug: it broke Pi RPC mode, which expects well-formed JSON-LD over stdout and can't tolerate arbitrary interleaved text). Removed the obsolete assertions rather than restoring the print.

4. devtools/distribution-invariants.test.ts's 'neutral Pi capability entrypoint' invariant check hardcoded a path to plugins/pi/extensions/capabilities.ts -- a real regression from today's earlier neutral-capability-extension split (AGENT-231), which deleted that file. Updated to check all 4 replacement files (skill-loading.ts, turn-control.ts, context-management.ts, background-process.ts).

Left alone as genuinely unrelated: devtools/npmPackageInstallSmoke.test.ts (pre-existing, present at the very start of this session, times out in afterEach cleanup doing real npm pack/install -- unrelated to anything touched today) and devtools/standaloneSandpiperAppRuntime.test.ts's apparent full-suite timeout (confirmed flaky-under-parallel-execution, passes cleanly in isolation at ~1.3s).

Verified: check:tsc clean, check:biome-check clean, all 14 directly affected test files pass (69 tests).

---

# Activity Log

## 2026-07-11T01:30:21.103Z

- **status**: NOT STARTED → NEEDS REVIEW

## 2026-07-11T01:30:21.372Z

- **status**: NEEDS REVIEW → COMPLETE
- **resolution**: DONE

## 2026-07-11T01:30:47.937Z

- **description**: updated
