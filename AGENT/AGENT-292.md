---
title: "Sandpiper leaks PI_PACKAGE_DIR into child processes, so nested pi runs as sandpiper"
status: NOT STARTED
kind: BUG
priority: MEDIUM
assignee: UNASSIGNED
reporter: AGENT
created_at: 2026-10-05T21:47:30.780Z
updated_at: 2026-10-05T21:47:30.780Z
related:
  - AGENT-290
  - TOOLS-9
---

# Sandpiper leaks PI_PACKAGE_DIR into child processes, so nested pi runs as sandpiper

packages/cli/standalone_bootstrap.ts configurePiEnvironment() sets PI_PACKAGE_DIR (plus PI_CODING_AGENT_PACKAGE/VERSION, PI_SKIP_VERSION_CHECK) on process.env before importing Pi. Pi reads PI_PACKAGE_DIR for its own package identity, and the bash tool and background processes inherit the variable.

Evidence (2026-10-05, inside a Sandpiper session): 'pi --help' prints 'sandpiper - AI coding assistant...' and 'pi --version' prints 0.0.1 (Sandpiper's package.json). With 'env -u PI_PACKAGE_DIR' the same binary prints 'pi' and 1.0.3. A nested pi therefore takes Sandpiper's piConfig (name sandpiper, configDir .sandpiper) and operates on ~/.sandpiper/agent state.

This is the cause of the misleading 'pi --version reports 0.0.1' note in the AGENT-289/AGENT-290 handoff. Fix direction: keep Pi's package-identity variables process-local, for example by scrubbing them from the environment Pi passes to tools/children, or by resolving package identity without exporting process-wide env; verify against Pi 1.0 env handling.
