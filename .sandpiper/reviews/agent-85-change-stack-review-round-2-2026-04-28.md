# Code Review Round 2 — `agent-85` Change Stack

**Date:** 2026-04-28  
**Reviewer:** Sandpiper agent  
**Reviewed workspace:** `/Users/doug.stephen/git/sandpiper-ai-agent-85`  
**Reviewed revset:** `main..agent-85@`  
**Current tip:** `wmkotooy dd30e1fc` empty working-copy commit, parent `purtokxx 01368da6 AGENT-99: address standalone review findings`  
**Related tasks:** AGENT-85, AGENT-99, AGENT-100..105  
**Mode:** Diff re-review

## Verdict

**Mergeable from this review's perspective.** The round-1 blockers and major finding are resolved. I found no remaining blocker or major issues.

Summary: **0 blockers, 0 major, 1 minor, positives noted.**

## Health Summary

| Check | Result |
| --- | --- |
| Working copy | ✅ clean in `/Users/doug.stephen/git/sandpiper-ai-agent-85` |
| Files changed vs `main` | 28 |
| TypeScript files analyzed | 11 |
| `bun check` | ✅ clean |
| `bun run test:standalone` | ✅ 4 files / 8 tests passing under Vitest |
| `bun x vitest run packages/core/src/system-prompt.test.ts` | ✅ 32 tests passing |
| `uvx lizard -l typescript ...` | ✅ no thresholds exceeded; worst CC = 5 in changed/reviewed scope |
| `jscpd` on reviewed TS scope | ⚠️ 3.84% duplication; only minor spike/probe duplication remains |
| `bun run sandpiper-standalone-dev -- --help ...` | ✅ source dogfood help shows Sandpiper extension flags |
| `bun run build:standalone` | ✅ builds Bun-targeted standalone bundle |
| `bun run sandpiper-standalone-built -- --help ...` | ✅ built bundle help shows Sandpiper extension flags |
| Built sidecar package metadata smoke | ✅ sidecar version `9.8.7` returned by built bundle |
| Direct execution of built bundle | ✅ works after executable bit; shebang now targets Bun |
| `bun run --bun packages/cli/standalone_resource_probe.ts` | ✅ spike resource probe still passes |
| `bash devtools/postinstall.sh` | ✅ clean; legacy package install skipped by default |
| Type-safety escape scan | ✅ no `as any`, no `@ts-ignore`, no `@ts-expect-error` in reviewed TS scope |

## Round-1 Finding Status

### ✅ Blocker 1 — Dogfood standalone entrypoint loaded Pi before `PI_PACKAGE_DIR` was configured

**Status:** Resolved.

`packages/cli/sandpiper_standalone.ts` now only statically imports local bootstrap code before calling `configurePiEnvironment()`. The Pi runtime import and the resource-factory import are both dynamic and occur after environment configuration:

```ts
configurePiEnvironment(...);

const { main } = await import('@mariozechner/pi-coding-agent');
const { createSandpiperExtensionFactories } = await import('./sandpiper_resources.js');
```

The new sidecar metadata test in `packages/cli/standalone_cli_smoke.test.ts` reproduces the previous failure mode by clearing `PI_PACKAGE_DIR`, `PI_CODING_AGENT_PACKAGE`, and `PI_CODING_AGENT_VERSION`, then asserting `--version` returns the sidecar package version.

I also manually verified the built bundle path:

```bash
env -u PI_PACKAGE_DIR -u PI_CODING_AGENT_PACKAGE -u PI_CODING_AGENT_VERSION \
  SANDPIPER_STANDALONE_RESOURCE_ROOT="$PWD" \
  SANDPIPER_STANDALONE_PACKAGE_DIR="$tmp/package" \
  SANDPIPER_CODING_AGENT_DIR="$tmp/agent" \
  bun ./packages/cli/dist/standalone/sandpiper_standalone.js --version
# 9.8.7
```

### ✅ Blocker 2 — Standalone tests failed under the repo's standard Vitest runner

**Status:** Resolved.

`package.json` now runs standalone tests through Vitest:

```json
"test:standalone": "bun x vitest run packages/cli/standalone_bootstrap.test.ts packages/cli/sandpiper_resources.test.ts packages/cli/standalone_cli_smoke.test.ts packages/cli/standalone_resource_discovery.test.ts"
```

The subprocess helper in `standalone_cli_smoke.test.ts` now invokes Bun explicitly instead of assuming `process.execPath` is Bun:

```ts
const bunExecutable = process.env.BUN_EXECUTABLE ?? 'bun';
execFileSync(bunExecutable, ['run', '--bun', './packages/cli/sandpiper_standalone.ts', ...args], ...);
```

Verified:

```bash
bun run test:standalone
# 4 files / 8 tests passing
```

### ✅ Major — Dogfood resource discovery was not covered end-to-end

**Status:** Resolved.

`packages/cli/standalone_resource_discovery.test.ts` now exercises the production-shaped `createSandpiperExtensionFactories(repoRoot)` path with a real `DefaultResourceLoader` and in-memory session. It calls `session.bindExtensions({})` and asserts bundled skills and prompts appear via `resources_discover`.

This covers the actual dogfood resource path rather than only the fixture probe.

### ✅ Minor — Built bundle had a Node shebang/direct-exec footgun

**Status:** Resolved.

`packages/cli/sandpiper_standalone.ts`, `standalone_spike.ts`, and `standalone_resource_probe.ts` now use:

```bash
#!/usr/bin/env bun
```

I verified direct execution of the built bundle after setting the executable bit:

```bash
chmod +x packages/cli/dist/standalone/sandpiper_standalone.js
./packages/cli/dist/standalone/sandpiper_standalone.js --version
# 0.0.1
```

### ⚠️ Minor — Spike/probe duplication remains, but reduced

**Status:** Improved; non-blocking.

The duplicate repo-root helper was consolidated through `findPackageRoot()` in `standalone_bootstrap.ts`. `jscpd` dropped from 5.33% to 3.84% duplication.

Remaining duplication is mainly between:

- `standalone_resource_probe.ts` and `standalone_resource_discovery.test.ts` around constructing a resource loader/session and binding extensions;
- `standalone_spike.ts` and `standalone_resource_probe.ts` around the tiny fixture resource-discovery extension.

This is acceptable for spike/probe code. If these files become long-lived production fixtures, consider extracting a small shared test/probe helper.

## Additional Notes

- `standalone_resource_discovery.test.ts` correctly disposes the SDK session and restores mutated `PI_PACKAGE_DIR` / `PI_SKIP_VERSION_CHECK` environment values in `finally` blocks.
- The sidecar metadata regression is now covered in a subprocess, which is the right level for import-order bugs that depend on module initialization timing.
- The built sidecar smoke is not in the automated test suite yet. That is fine for this dogfood slice because `build:standalone` is still documented as a Bun-targeted bundle, not the final app-bundle distribution. AGENT-89/AGENT-91 should likely automate the built/app-bundle smoke later.

## Positives

- The round-1 feedback was addressed directly and with targeted tests, not just code changes.
- The import-order fix preserves the simple entrypoint shape.
- Test coverage now includes the two important failure modes: sidecar metadata and production resource discovery.
- The postinstall opt-in behavior remains verified and documented.
- The stack stays small enough to audit; no new abstraction was introduced beyond the existing bootstrap/resource split.

## Verification Commands Run

```bash
cd /Users/doug.stephen/git/sandpiper-ai-agent-85
jj status --no-pager
bun check
bun run test:standalone
bun x vitest run packages/core/src/system-prompt.test.ts
uvx lizard -l typescript packages/cli/pi_wrapper.ts packages/cli/sandpiper_resources.test.ts packages/cli/sandpiper_resources.ts packages/cli/sandpiper_standalone.ts packages/cli/standalone_bootstrap.test.ts packages/cli/standalone_bootstrap.ts packages/cli/standalone_cli_smoke.test.ts packages/cli/standalone_resource_discovery.test.ts packages/cli/standalone_resource_probe.ts packages/cli/standalone_spike.ts packages/core/src/system-prompt.test.ts
bunx jscpd packages/cli/standalone_bootstrap.ts packages/cli/sandpiper_resources.ts packages/cli/sandpiper_standalone.ts packages/cli/standalone_spike.ts packages/cli/standalone_resource_probe.ts packages/cli/standalone_resource_discovery.test.ts packages/cli/standalone_cli_smoke.test.ts packages/cli/sandpiper_resources.test.ts packages/cli/standalone_bootstrap.test.ts packages/core/src/system-prompt.test.ts --reporters json --output /tmp/agent85-rereview-jscpd
bun run sandpiper-standalone-dev -- --help --no-extensions --no-skills --no-prompt-templates --no-themes --no-context-files
bun run build:standalone
bun run sandpiper-standalone-built -- --help --no-extensions --no-skills --no-prompt-templates --no-themes --no-context-files
bun run --bun packages/cli/standalone_resource_probe.ts
bash devtools/postinstall.sh
```
