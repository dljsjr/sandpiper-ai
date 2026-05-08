# Environment Variable Handling

Guidelines for reading and writing environment variables in Sandpiper.

## Overview

Sandpiper mirrors `PI_*` environment variables into the `SANDPIPER_*` namespace (and vice versa). This allows users to configure the agent using either namespace while keeping internal code consistent.

## The Mirroring Model

At startup, the Sandpiper CLI runtime performs two-phase mirroring:

1. **PI → SANDPIPER** — When a `SANDPIPER_*` var is not already set
2. **SANDPIPER → PI** — Unconditionally, so Sandpiper overrides win

This means:

- Users can set either `SANDPIPER_OFFLINE=1` or `PI_OFFLINE=1` — both work
- If both are set, `SANDPIPER_*` wins
- Internal code always reads through Sandpiper-first lookup

## Reading Environment Variables

### Use `resolveEnvVar()` for Mirrored Variables

Always use `resolveEnvVar(name)` from `sandpiper-ai-core` to read env vars that exist in both namespaces:

```typescript
import { resolveEnvVar } from "sandpiper-ai-core";

// ✅ Correct — checks SANDPIPER_OFFLINE, then PI_OFFLINE
if (resolveEnvVar("OFFLINE") === "1") {
  // Handle offline mode
}

// ❌ Wrong — misses the SANDPIPER_* override
if (process.env.PI_OFFLINE === "1") {
  // This won't work if user set SANDPIPER_OFFLINE instead
}
```

**Why this matters**: If you read `process.env.PI_OFFLINE` directly, you'll miss cases where the user set `SANDPIPER_OFFLINE=1`.

### Runtime-owned Variables

The package/version variables below are set by the Sandpiper runtime and are not normal mirrored user configuration:

| Variable | Purpose | Read with |
| -------- | ------- | --------- |
| `SANDPIPER_CODING_AGENT_PACKAGE` | Path to the Sandpiper package root, including shipped public docs | `process.env.SANDPIPER_CODING_AGENT_PACKAGE` |
| `PI_CODING_AGENT_PACKAGE` | Path to the wrapped pi-coding-agent package root | `process.env.PI_CODING_AGENT_PACKAGE` |
| `PI_CODING_AGENT_VERSION` | Pi version string | `process.env.PI_CODING_AGENT_VERSION` |
| `PI_PACKAGE_DIR` | Pi package directory override | `process.env.PI_PACKAGE_DIR` |
| `PI_SKIP_VERSION_CHECK` | Suppress Pi update check | `process.env.PI_SKIP_VERSION_CHECK` |

`SANDPIPER_CODING_AGENT_PACKAGE` and `PI_CODING_AGENT_PACKAGE` deliberately have different meanings. Do not mirror one into the other. Use `resolveEnvVar()` for user-facing configuration such as `OFFLINE`, not for runtime-owned package roots.

```typescript
// ✅ Correct for runtime-owned package roots
const sandpiperPackagePath = process.env.SANDPIPER_CODING_AGENT_PACKAGE;
const piPackagePath = process.env.PI_CODING_AGENT_PACKAGE;

// ✅ Correct for mirrored user configuration
const offline = resolveEnvVar("OFFLINE") === "1";
```

## Writing Environment Variables

### Setting Variables for Subprocesses

When spawning subprocesses, you may need to set env vars:

```typescript
import { spawn } from "node:child_process";

// Propagate both namespaces for subprocess compatibility
const env = {
  ...process.env,
  SANDPIPER_OFFLINE: "1", // Sandpiper namespace
  PI_OFFLINE: "1", // Pi namespace (for backwards compat)
};

const proc = spawn("pi", ["--offline"], { env });
```

### When to Set Both Namespaces

Set both `SANDPIPER_*` and `PI_*` when:

- Spawning Pi subprocesses (they may read either namespace)
- Ensuring backwards compatibility with Pi-only code
- Debugging (explicit is clearer than implicit mirroring)

## Configuration Path Resolution

Sandpiper uses `resolveEnvVar()` for config path overrides:

```typescript
const agentDir =
  resolveEnvVar("AGENT_DIR") ?? join(homedir(), ".sandpiper", "agent");
```

This allows users to override with either `SANDPIPER_AGENT_DIR` or `PI_AGENT_DIR`.

**Best practice**: Prefer existing env/config resolution paths before adding new path knobs. Don't invent ad hoc overrides when `resolveEnvVar()` or existing config plumbing already covers the case.

## Common Patterns

### Feature Flags

```typescript
// Check for feature flag (user can set either namespace)
if (resolveEnvVar("EXPERIMENTAL_FEATURE") === "1") {
  // Enable experimental feature
}
```

### Debug Mode

```typescript
const debug = resolveEnvVar("DEBUG") === "1";
if (debug) {
  console.log("Debug mode enabled");
}
```

### Offline Mode

```typescript
if (resolveEnvVar("OFFLINE") === "1") {
  // Disable network requests
  // Works with either SANDPIPER_OFFLINE=1 or PI_OFFLINE=1
}
```

## Testing

When writing tests, avoid relying on real environment variables:

```typescript
// ❌ Wrong — depends on real env
const offline = process.env.PI_OFFLINE === "1";

// ✅ Correct — parameterize or mock
const offline = process.env.SANDPIPER_TEST_OFFLINE === "1";
```

For tests that need specific env vars:

```typescript
import { describe, it, expect, beforeEach, afterEach } from "vitest";

describe("offline mode", () => {
  beforeEach(() => {
    process.env.SANDPIPER_OFFLINE = "1";
  });

  afterEach(() => {
    delete process.env.SANDPIPER_OFFLINE;
  });

  it("disables network requests", () => {
    // Test with offline mode enabled
  });
});
```

## Related Documentation

- [Pi extension development](./pi-extension-development.md) — Where Pi runtime behavior fits into Sandpiper
- [Env Vars Implementation](../../packages/core/src/env.ts) — `resolveEnvVar()` source code
