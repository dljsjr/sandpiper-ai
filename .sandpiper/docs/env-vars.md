# Environment Variables

Read when: reading or writing env vars, mirroring `PI_*` / `SANDPIPER_*`, choosing config-path overrides, or touching the wrapper/core env helpers.
Last verified: 2026-03-30

## Key Rules

- Use `resolveEnvVar(name)` from `sandpiper-ai-core` for mirrored Sandpiper/Pi variables.
- `SANDPIPER_*` wins over `PI_*` when both are set for a mirrored variable.
- Four `PI_*` variables are exempt from mirroring and should usually be read directly from `process.env.PI_*`.
- Prefer existing env/config resolution paths before adding new path knobs; do not invent ad hoc overrides when `resolveEnvVar()` or existing config plumbing already covers the case.
- The wrapper performs two-phase mirroring so users can configure either namespace while Sandpiper code consistently reads through the Sandpiper-first lookup path.

## Canonical Examples

- `packages/core/src/env.ts`
- `packages/cli/pi_wrapper.ts`
- `packages/core/src/migrate-pi-configs.ts`

## Reference

Sandpiper mirrors `PI_*` env vars into the `SANDPIPER_*` namespace (and vice versa) at startup via `pi_wrapper.ts`. This means users can set either `SANDPIPER_OFFLINE=1` or `PI_OFFLINE=1` and it works.

## Use `resolveEnvVar()` in our code

Always use `resolveEnvVar(name)` from `sandpiper-ai-core` to read env vars that exist in both namespaces. It checks `SANDPIPER_*` first, then falls back to `PI_*`:

```typescript
import { resolveEnvVar } from "sandpiper-ai-core";

// ✅ Correct — checks SANDPIPER_OFFLINE, then PI_OFFLINE
if (resolveEnvVar("OFFLINE") === "1") { ... }

// ❌ Wrong — misses the SANDPIPER_* override
if (process.env.PI_OFFLINE === "1") { ... }
```

## Exempt variables

Four `PI_*` variables are exempt from mirroring and are usually clearer when accessed directly via `process.env.PI_*`:

| Variable | Category | Purpose |
| --- | --- | --- |
| `PI_CODING_AGENT_PACKAGE` | Sandpiper internal | Path to the pi-coding-agent package (for self-improvement prompting, doc exploration) |
| `PI_CODING_AGENT_VERSION` | Sandpiper internal | Version of the underlying pi-coding-agent |
| `PI_PACKAGE_DIR` | Pi behavior control | Package directory pi loads extensions / skills from |
| `PI_SKIP_VERSION_CHECK` | Pi behavior control | Suppresses pi's built-in update check (Sandpiper has its own) |

`resolveEnvVar()` handles these gracefully, but prefer `process.env.PI_*` directly for clarity when you know you are dealing with one of these special cases.

## Mirroring model

`packages/cli/pi_wrapper.ts` performs two phases:

1. **PI → SANDPIPER** when a Sandpiper var is not already set
2. **SANDPIPER → PI** unconditionally for mirrored vars, so Sandpiper overrides win

This gives users flexibility in how they configure the agent while keeping internal reads consistent.

## Related Docs

- [pi-api-pitfalls.md](pi-api-pitfalls.md) — extension lifecycle and API gotchas often encountered alongside env work
- [agent-guidance-evolution.md](agent-guidance-evolution.md) — prompt-architecture plan for agent guidance docs
