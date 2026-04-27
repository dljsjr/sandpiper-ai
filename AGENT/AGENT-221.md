---
title: "Adopt/verify CONFIG_DIR_NAME (+ APP_NAME) rebrand extension points for .sandpiper"
status: COMPLETE
resolution: DONE
kind: TASK
priority: LOW
assignee: "sandpiper-0.84-dev"
reporter: USER
created_at: 2026-06-23T20:28:30.187Z
updated_at: 2026-08-07T03:12:58.849Z
---

# Adopt/verify CONFIG_DIR_NAME (+ APP_NAME) rebrand extension points for .sandpiper

Pi 0.79.7 (#5869) exported CONFIG_DIR_NAME so extensions resolve project config paths without hardcoding '.pi'. An older changelog entry notes CONFIG_DIR_NAME + APP_NAME are THE SDK rebrand extension points. Sandpiper rebrands .pi -> .sandpiper.

FIRST STEP (grounding): check whether Sandpiper already routes .sandpiper path resolution through CONFIG_DIR_NAME/APP_NAME or hardcodes it. Note: packages/core/src/migrate-pi-configs.ts intentionally hardcodes the OLD .pi layout for migration - that is correct and out of scope.

VERIFIED 2026-08-06 at v0.84.0: exports and mechanism unchanged; the well-placed package.json piConfig remains the only rebrand extension point (see TOOLS-9 for the upstream env-override ask), so this task's scope is intact and no longer gated on any version bump. Fold into verification: pi 0.82.0 (#6958) fixed TUI debug/crash logs to respect custom agent dirs instead of always writing under ~/.pi/agent - confirm sandpiper logs land under ~/.sandpiper/agent after the AGENT-236 bump.

## Verification (2026-08-07)

**Grounding confirmed, no hand-resolution found.** Sandpiper source never imports or references CONFIG_DIR_NAME/APP_NAME anywhere (grepped extensions/, packages/, devtools/ — zero hits). The rebrand is achieved entirely through the `piConfig: { name: "sandpiper", configDir: ".sandpiper", bin: "sandpiper" }` block in root package.json — Pi's own internal `config.js` reads this via `getPackageJsonPath()` (= `join(getPackageDir(), "package.json")`) at module load, and derives `CONFIG_DIR_NAME`/`APP_NAME` from it (config.js:390-394). This is the intended mechanism, not debt: Sandpiper doesn't need to touch these constants because Pi's own internals (getAgentDir, getDebugLogPath, getModelsPath, etc. — all of config.js's `~/.pi/agent/*` family) already consume them correctly once the piConfig block is present. Presence/propagation of this piConfig block through the whole distribution pipeline (root → generated dist package.json → materialized manifest → standalone app bundle) was already covered by existing tests: devtools/distribution-smoke.test.ts:40,58-83 and devtools/standaloneSandpiperApp.test.ts:50.

**Crash-log-location check (the one previously-unverified observable): CONFIRMED.** Added a regression test (devtools/rootPiPackageSmoke.test.ts, new `it` in the existing "root Pi package smoke" describe block) that dynamically imports @earendil-works/pi-coding-agent with PI_PACKAGE_DIR pointed at this repo's root (real on-disk package.json, real piConfig block) and no SANDPIPER_CODING_AGENT_DIR override, asserting CONFIG_DIR_NAME === '.sandpiper' and getAgentDir() === join(homedir(), '.sandpiper', 'agent') — i.e. the unoverridden fallback (post pi 0.82.0 #6958's respect-custom-agent-dir fix) lands under ~/.sandpiper/agent, not ~/.pi/agent. (APP_NAME and getDebugLogPath() aren't part of pi-coding-agent's public `exports` map, so they can't be asserted directly without reaching into package internals; getAgentDir()/CONFIG_DIR_NAME are both public and sufficient to prove the directory-level observable, since getDebugLogPath() is just `${APP_NAME}-debug.log` joined onto the same getAgentDir() this test already pins.)

No source changes — this was a pure verification task with a new regression test added to lock in the finding. Not WONTFIX (unlike AGENT-219): the grounding check and the crash-log observable both needed real verification work (grep sweep + a new test), even though the outcome is "already correct."

---

# Activity Log

## 2026-08-06T20:43:10.189Z

- **description**: updated

## 2026-08-07T03:03:14.019Z

- **status**: NOT STARTED → IN PROGRESS
- **assignee**: UNASSIGNED → sandpiper-0.84-dev

## 2026-08-07T03:09:31.777Z

- **description**: 5 lines → updated (13 lines)

## 2026-08-07T03:09:59.362Z

- **status**: IN PROGRESS → NEEDS REVIEW

## 2026-08-07T03:12:58.849Z

- **status**: NEEDS REVIEW → COMPLETE
- **resolution**: DONE
