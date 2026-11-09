---
name: Environment Variables
read_when: reading env vars, writing env vars, adding config paths, PI_ variables, SANDPIPER_ variables, config directory, host context, path resolution
---

# Environment Variables

Read this before adding or changing environment-variable behavior.

## Key Rules

- Read `process.env` directly. Startup mirroring makes `SANDPIPER_X` and `PI_X` equal, so either name works for user configuration.
- Pi can rewrite a `PI_*` variable it owns during its own startup (`--offline` sets `PI_OFFLINE=1`). Code that asks what Pi is doing reads the name Pi reads.
- Prefer `SANDPIPER_*` as the user-facing namespace for Sandpiper behavior.
- Keep Pi runtime-control variables in the `PI_*` namespace when they specifically control wrapped Pi behavior.
- Keep `SANDPIPER_CODING_AGENT_PACKAGE` distinct from `PI_CODING_AGENT_PACKAGE`; they point to different package roots and are not mirrored aliases.
- Do not invent ad hoc test-only path knobs; use existing config/path seams.
- Use `join()`, `resolve()`, and `homedir()` for paths. Do not manually expand `~`.

## Mirroring Model

Sandpiper supports both `SANDPIPER_*` and `PI_*` user configuration. When both are set, `SANDPIPER_*` wins. Mirroring runs in both entrypoints before any extension loads, so internal code reads `process.env` directly. Exempt Pi runtime variables are not mirrored.

## References

- Public guide: `docs/dev/env-vars.md`
- Mirroring implementation: `packages/cli/standalone_bootstrap.ts`
- Host/config path utilities: `packages/core/src/host-context.ts` and nearby modules
