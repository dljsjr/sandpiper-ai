---
name: Environment Variables
read_when: reading env vars, writing env vars, adding config paths, PI_ variables, SANDPIPER_ variables, resolveEnvVar, config directory, host context, path resolution
---

# Environment Variables

Read this before adding or changing environment-variable behavior.

## Key Rules

- Use `resolveEnvVar()` from `sandpiper-ai-core` for mirrored Sandpiper/Pi variables.
- Prefer `SANDPIPER_*` as the user-facing namespace for Sandpiper behavior.
- Keep Pi runtime-control variables in the `PI_*` namespace when they specifically control wrapped Pi behavior.
- Do not invent ad hoc test-only path knobs; use existing config/path seams.
- Use `join()`, `resolve()`, and `homedir()` for paths. Do not manually expand `~`.

## Mirroring Model

Sandpiper supports both `SANDPIPER_*` and `PI_*` user configuration. When both are set, `SANDPIPER_*` wins. Internal code should avoid direct `process.env.PI_*` reads except for exempt Pi runtime variables.

## References

- Public guide: `docs/dev/env-vars.md`
- Core implementation: `packages/core/src/env.ts`
- Host/config path utilities: `packages/core/src/host-context.ts` and nearby modules
