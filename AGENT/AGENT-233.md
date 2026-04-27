---
title: "Gate pi-coding-agent version diagnostic behind SANDPIPER_PRINT_PI_VERSION, print to stderr"
status: COMPLETE
resolution: DONE
kind: TASK
priority: LOW
assignee: UNASSIGNED
reporter: USER
created_at: 2026-07-11T16:50:44.979Z
updated_at: 2026-07-11T16:50:45.369Z
---

# Gate pi-coding-agent version diagnostic behind SANDPIPER_PRINT_PI_VERSION, print to stderr

Follow-up to df04a14d's shell-relay disable, which also commented out a console.log printing the resolved pi-coding-agent version (needed because it broke Pi RPC mode -- stdout must be well-formed JSON-LD there).

Doug wants this back for debugging distribution machinery, but both gated (opt-in) and on stderr rather than stdout. Precedent exists: SANDPIPER_SHOW_PI_VERSION + a --show-pi-version flag were tried in April (b0b36c66, 32b56568) then reverted the same session (llvmzzvu) with no recorded reason -- that version used console.log (stdout), so it would have hit the same RPC conflict discovered today if RPC mode had been in play then.

This time: SANDPIPER_PRINT_PI_VERSION=1 env var (no CLI flag -- kept deliberately minimal), console.error (stderr) instead of console.log, in packages/cli/sandpiper_standalone.ts. Verified manually that stdout stays clean (just the actual --version output) and the diagnostic line appears only on stderr when the env var is set. Default (unset) behavior unchanged -- confirmed via the existing standalone_cli_smoke.test.ts / standaloneSandpiperAppCompile.test.ts suites, which assert stdout does not contain it.

Verified: check:tsc clean, check:biome-check clean, all affected tests pass.

---

# Activity Log

## 2026-07-11T16:50:45.085Z

- **status**: NOT STARTED → NEEDS REVIEW

## 2026-07-11T16:50:45.372Z

- **status**: NEEDS REVIEW → COMPLETE
- **resolution**: DONE
