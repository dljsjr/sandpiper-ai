# Environment Variables

Sandpiper mirrors `PI_*` env vars into the `SANDPIPER_*` namespace (and vice versa) at startup via `pi_wrapper.ts`. This means users can set either `SANDPIPER_OFFLINE=1` or `PI_OFFLINE=1` and it works.

## Use `resolveEnvVar()` in our code

Always use `resolveEnvVar(name)` from `sandpiper-ai-core` to read env vars that exist in both namespaces. It checks `SANDPIPER_*` first, then falls back to `PI_*`:

```typescript
import { resolveEnvVar } from 'sandpiper-ai-core';

// ✅ Correct — checks SANDPIPER_OFFLINE, then PI_OFFLINE
if (resolveEnvVar('OFFLINE') === '1') { ... }

// ❌ Wrong — misses the SANDPIPER_* override
if (process.env.PI_OFFLINE === '1') { ... }
```

## Exempt variables

Four `PI_*` variables are exempt from mirroring and should be accessed directly via `process.env.PI_*`:

| Variable | Category | Purpose |
|----------|----------|---------|
| `PI_CODING_AGENT_PACKAGE` | Sandpiper internal | Path to the pi-coding-agent package (for self-improvement prompting, doc exploration) |
| `PI_CODING_AGENT_VERSION` | Sandpiper internal | Version of the underlying pi-coding-agent |
| `PI_PACKAGE_DIR` | Pi behavior control | Package directory pi loads extensions/skills from |
| `PI_SKIP_VERSION_CHECK` | Pi behavior control | Suppresses pi's built-in update check (sandpiper has its own) |

`resolveEnvVar()` handles these gracefully (short-circuits to the `PI_*` value), but prefer `process.env.PI_*` directly for clarity.
