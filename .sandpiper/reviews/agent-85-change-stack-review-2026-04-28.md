# Code Review — `agent-85` Change Stack

**Date:** 2026-04-28  
**Reviewer:** Sandpiper agent  
**Reviewed workspace:** `/Users/doug.stephen/git/sandpiper-ai-agent-85`  
**Reviewed revset:** `main..agent-85@`  
**Related tasks:** AGENT-85, AGENT-99, AGENT-100..105  
**Mode:** Diff review

## Verdict

**Not merge-ready yet.** The standalone direction is sound, and the implementation is small, but the dogfood standalone entrypoint currently violates the core import-order/package-metadata requirement and the new tests only pass under `bun test`, not the repo's standard Vitest runner.

Summary: **2 blockers, 1 major, 2 minor, positives noted.**

## Health Summary

| Check | Result |
| --- | --- |
| Files changed | 27 |
| TypeScript files analyzed | 10 |
| `uvx lizard -l typescript ...` | ✅ no thresholds exceeded; worst CC = 6 |
| `bun check` | ✅ clean |
| `bun run test:standalone` | ✅ 6/6 passing |
| `bun x vitest run packages/cli/standalone_bootstrap.test.ts packages/cli/sandpiper_resources.test.ts packages/cli/standalone_cli_smoke.test.ts` | ❌ fails; subprocess uses Node as `process.execPath` |
| `bun run sandpiper-standalone-dev -- --help ...` | ✅ extension flags appear |
| `bun run build:standalone` | ✅ builds Bun-targeted bundle |
| `bun run sandpiper-standalone-built -- --help ...` | ✅ works when invoked via Bun |
| `bun run --bun packages/cli/standalone_resource_probe.ts` | ✅ spike resource discovery probe passes |
| `bash devtools/postinstall.sh` | ✅ clean; legacy package install skipped by default |
| Manual sidecar package metadata smoke | ❌ dogfood entrypoint reports Pi package metadata, not sidecar metadata |
| `jscpd` on reviewed TS scope | ⚠️ 5.33% duplication, concentrated in spike/probe helpers |

## Findings

### Blocker — Dogfood standalone entrypoint loads Pi before `PI_PACKAGE_DIR` is configured

**Location:** `packages/cli/sandpiper_standalone.ts:6-7`, `packages/cli/sandpiper_resources.ts:2-6`, `extensions/system/diagnostics-hooks.ts:2`

`packages/cli/sandpiper_standalone.ts` statically imports `createSandpiperExtensionFactories` before calling `configurePiEnvironment()`:

```ts
import { createSandpiperExtensionFactories } from './sandpiper_resources.js';
import { configurePiEnvironment, resolveStandalonePaths } from './standalone_bootstrap.js';
```

That resource module imports the system extension, which imports a runtime value from `@mariozechner/pi-coding-agent`:

```ts
import { DynamicBorder } from '@mariozechner/pi-coding-agent';
```

Because Pi computes package metadata/config constants at module import time, this means Pi can be initialized before `PI_PACKAGE_DIR` points at the standalone package directory. This directly violates the spike's documented requirement: set package metadata before importing Pi.

Evidence with a temporary sidecar package version `9.8.7`:

```bash
env -u PI_PACKAGE_DIR -u PI_CODING_AGENT_PACKAGE -u PI_CODING_AGENT_VERSION \
  SANDPIPER_STANDALONE_RESOURCE_ROOT="$PWD" \
  SANDPIPER_STANDALONE_PACKAGE_DIR="$tmp" \
  SANDPIPER_TEST_CODING_AGENT_DIR="$tmp/agent" \
  bun run --bun ./packages/cli/sandpiper_standalone.ts --version
# actual: 0.70.2
# expected: 9.8.7
```

`--help` also branded as `pi` rather than the sidecar `piConfig.name`, confirming the package/config constants were already frozen from the upstream Pi package.

The earlier spike entrypoint (`packages/cli/standalone_spike.ts`) behaves correctly under the same sidecar setup, so this is a dogfood entrypoint regression rather than a Pi limitation.

**Suggestion:** keep `standalone_bootstrap` as the only static local import in `sandpiper_standalone.ts`; after `configurePiEnvironment()` runs, dynamically import both `@mariozechner/pi-coding-agent` and `./sandpiper_resources.js`:

```ts
configurePiEnvironment(...);

const [{ main }, { createSandpiperExtensionFactories }] = await Promise.all([
  import('@mariozechner/pi-coding-agent'),
  import('./sandpiper_resources.js'),
]);
```

Then add a clean-env sidecar test asserting `--version` comes from the sidecar package.

---

### Blocker — New standalone tests fail under the repo's standard Vitest runner

**Location:** `package.json:15`, `packages/cli/standalone_cli_smoke.test.ts:14-26`

The repo standard is Vitest, but the new `test:standalone` script uses `bun test`:

```json
"test:standalone": "bun test packages/cli/standalone_bootstrap.test.ts packages/cli/sandpiper_resources.test.ts packages/cli/standalone_cli_smoke.test.ts"
```

The smoke test depends on `process.execPath` being Bun:

```ts
execFileSync(process.execPath, ['run', '--bun', './packages/cli/sandpiper_standalone.ts', ...])
```

Under Vitest, `process.execPath` is Node, so the subprocess becomes `node run --bun ...` and fails:

```bash
bun x vitest run packages/cli/standalone_bootstrap.test.ts \
  packages/cli/sandpiper_resources.test.ts \
  packages/cli/standalone_cli_smoke.test.ts

# Error: Cannot find module '/Users/doug.stephen/git/sandpiper-ai-agent-85/run'
```

**Suggestion:** invoke Bun explicitly in the test (for example, resolve `bun` from the environment/PATH or use the project convention for Bun subprocess tests), then change `test:standalone` to use Vitest.

---

### Major — Dogfood resource discovery is not covered end-to-end

**Location:** `packages/cli/sandpiper_resources.test.ts`, `packages/cli/standalone_cli_smoke.test.ts`

The current dogfood smoke test proves extension flags appear in help, but it does not prove the dogfood resource extension loads bundled skills/prompts/themes through `resources_discover`. That is one of the core AGENT-99 acceptance criteria.

There is a separate spike probe (`packages/cli/standalone_resource_probe.ts`) that proves resource discovery with the fixture skill, but the production-shaped `createSandpiperExtensionFactories(resourceRoot)` path should be tested directly.

Manual verification showed the production resource extension can load skills/prompts:

```bash
# DefaultResourceLoader + createSandpiperExtensionFactories(process.cwd()) + session.bindExtensions({})
# observed: skills include ast-grep/tasks/test-driven-development; prompts include new-feature/review-prd/...
```

**Suggestion:** add a Vitest integration test with temp agent state that:

1. constructs a `DefaultResourceLoader` with `extensionFactories: createSandpiperExtensionFactories(repoRoot)` and discovery disabled;
2. creates an in-memory session;
3. calls `session.bindExtensions({})`;
4. asserts expected bundled skills and prompts are present.

---

### Minor — Bun-targeted built bundle has a misleading Node shebang/direct-exec footgun

**Location:** `packages/cli/sandpiper_standalone.ts:1`, `packages/cli/package.json:20`

The built dogfood target is intentionally Bun-targeted and works when invoked as documented:

```bash
bun ./packages/cli/dist/standalone/sandpiper_standalone.js --help ...
```

However, because the source has `#!/usr/bin/env node`, direct execution runs under Node and fails. This is not blocking because the docs say to invoke the bundle through Bun, but the shebang is misleading for an executable-looking CLI artifact.

**Suggestion:** either remove/change the shebang for the Bun-targeted bundle, or explicitly document that the built JS artifact is not directly executable until the final app-bundle/compile work lands.

---

### Minor — Spike/probe helper duplication should be consolidated if these files stay

**Location:** `packages/cli/standalone_spike.ts`, `packages/cli/standalone_resource_probe.ts`

`jscpd` found two clones between the spike and resource probe helpers:

- repo-root/package-dir resolution helper block
- resource-discovery extension helper block

This is acceptable for short-lived spike files, but if these remain in-tree beyond the spike, they should reuse `standalone_bootstrap.ts` or another shared helper so future sidecar/resource behavior does not diverge.

## Positives

- The bootstrap/resource adapter split is small and readable.
- `configurePiEnvironment()` centralizes the explicit Pi environment variables and is easy to test.
- The postinstall opt-in change is well documented and verified. It addresses real multi-workspace duplicate package registration risk.
- Use of `main(args, { extensionFactories })` matches Pi 0.70.x's supported API.
- The standalone direction is viable; the main merge blockers are import ordering and test-runner compatibility, not the architecture itself.

## Suggested Follow-up Checklist

- [ ] Change `sandpiper_standalone.ts` so no Pi runtime value import can happen before `configurePiEnvironment()`.
- [ ] Add a clean-env sidecar metadata test that catches the current `--version`/branding regression.
- [ ] Make standalone tests pass under Vitest and update `test:standalone` accordingly.
- [ ] Add an end-to-end dogfood resource discovery test for real Sandpiper skills/prompts.
- [ ] Decide whether the Bun-targeted built bundle should keep a Node shebang.
- [ ] Consolidate spike/probe duplicate helpers if those files are intended to stay.
