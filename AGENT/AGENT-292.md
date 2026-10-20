---
title: "Integration harness passes the parent session PI_*/SANDPIPER_* env to spawned pi"
status: COMPLETE
resolution: DONE
kind: BUG
priority: MEDIUM
assignee: AGENT
reporter: AGENT
created_at: 2026-10-05T21:47:30.780Z
updated_at: 2026-10-19T21:06:06.257Z
related:
  - AGENT-290
  - TOOLS-9
---

# Integration harness passes the parent session PI_*/SANDPIPER_* env to spawned pi

packages/cli/standalone_bootstrap.ts configurePiEnvironment() sets PI_PACKAGE_DIR (plus PI_CODING_AGENT_PACKAGE/VERSION, PI_SKIP_VERSION_CHECK) on process.env before importing Pi. Pi reads PI_PACKAGE_DIR for its own package identity, and the bash tool and background processes inherit the variable.

Evidence (2026-10-05, inside a Sandpiper session): 'pi --help' prints 'sandpiper - AI coding assistant...' and 'pi --version' prints 0.0.1 (Sandpiper's package.json). With 'env -u PI_PACKAGE_DIR' the same binary prints 'pi' and 1.0.3. A nested pi therefore takes Sandpiper's piConfig (name sandpiper, configDir .sandpiper) and operates on ~/.sandpiper/agent state.

This is the cause of the misleading 'pi --version reports 0.0.1' note in the AGENT-289/AGENT-290 handoff. Fix direction: keep Pi's package-identity variables process-local, for example by scrubbing them from the environment Pi passes to tools/children, or by resolving package identity without exporting process-wide env; verify against Pi 1.0 env handling.

Rescoped 2026-10-19 (Doug): the only case worth fixing is the headless integration harness. devtools/integration/harness.ts prepareIsolatedSpawn() spreads process.env into the child's environment, so entry:'pi' tests inherit the parent Sandpiper session's PI_* and SANDPIPER_* variables (package identity, session ID/file, model, provider) whenever Vitest is started without `bun run test:vitest`'s `env -u PI_PACKAGE_DIR`. Fix: drop inherited PI_* and SANDPIPER_* keys before applying options.env and the harness's explicit isolation overrides. Agents running pi by hand from a Sandpiper bash tool is a known quirk and out of scope.

Done 2026-10-19: harness.ts drops inherited PI_* and SANDPIPER_* keys before options.env and the explicit isolation overrides (PI_OFFLINE not added: --offline is always passed and Pi sets PI_OFFLINE=1 itself). New harness test stubs PI_PACKAGE_DIR, PI_SESSION_FILE, SANDPIPER_SESSION_ID: failed before (child got /parent/standalone-package), passes after. devtools/integration passes via bun run test:vitest and via plain bunx vitest inside this Sandpiper session (34/34 each); a harness-spawned `pi --version` reports 1.3.0 with PI_PACKAGE_DIR set in the parent. bun check clean. test:vitest's env -u PI_PACKAGE_DIR left in place.

Follow-up 2026-10-19 (Doug): removed `env -u PI_PACKAGE_DIR` from test:vitest. The only other dependent was extensions/system/skill-loading-tool.test.ts (stubbed only PI_CODING_AGENT_DIR; with PI_PACKAGE_DIR=Sandpiper, Pi reads SANDPIPER_CODING_AGENT_DIR); it now stubs both. Full suite 129 files / 1,176 tests green with PI_PACKAGE_DIR set and unset; bun check clean. The documented distribution-gate command keeps its own env -u.

---

# Activity Log

## 2026-10-19T20:20:29.293Z

- **title**: Sandpiper leaks PI_PACKAGE_DIR into child processes, so nested pi runs as sandpiper → Integration harness passes the parent session PI_*/SANDPIPER_* env to spawned pi
- **description**: 5 lines → updated (7 lines)

## 2026-10-19T20:20:29.426Z

- **status**: NOT STARTED → IN PROGRESS
- **assignee**: UNASSIGNED → AGENT

## 2026-10-19T20:21:58.414Z

- **description**: 7 lines → updated (9 lines)

## 2026-10-19T20:21:58.531Z

- **status**: IN PROGRESS → NEEDS REVIEW

## 2026-10-19T20:33:18.986Z

- **description**: 9 lines → updated (11 lines)

## 2026-10-19T21:06:06.257Z

- **status**: NEEDS REVIEW → COMPLETE
- **resolution**: DONE
