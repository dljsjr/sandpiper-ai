# Code Review — `agent-86` Change Stack

**Date:** 2026-04-30
**Reviewer:** Sandpiper agent
**Reviewed workspace:** `/Users/doug.stephen/git/sandpiper-ai-agent-86`
**Reviewed revset:** `main..agent-86@`
**Related tasks:** AGENT-112, AGENT-113, AGENT-114, AGENT-115, AGENT-116
**Mode:** Diff review

## Verdict

**Merge-ready.** The `HostContext` seam is minimal, typed, and correctly placed at the library boundary. Consumers receive paths rather than constructing them from hardcoded sandpiper-specific strings. Backward compatibility is maintained throughout.

Summary: **0 blockers, 0 major, 2 minor, 2 nits, 5 positives.**

## Health Summary

| Check | Result |
| --- | --- |
| Files changed | 12 |
| Lines added/removed | +327 / -40 (net +287) |
| `lizard --csv` on changed TS | ✅ all under thresholds; worst CC = 16 (resolveStandupCommandContext, just above 15) |
| Longest function | 42 lines (installShellIntegrations) |
| `bun check` | ✅ clean (198 files, no fixes applied) |
| `bun --filter sandpiper-ai-core test` | ✅ 111 tests pass |
| `bun --filter sandpiper-standup-cli test` | ✅ 30 tests pass |
| `bun run test:standalone` | ✅ 18 tests pass |
| `rg` for stray `.sandpiper`/`SANDPIPER_` refs | ✅ only expected matches (env.ts, migrate, startup, system-prompt, install-shell-integrations default, helpers identity constants, CLI help text) |
| New public exports | 7 interfaces, 2 functions — clean, well-typed, all `readonly` |

## Findings

### Positive — Clean separation of concerns

**Location:** `packages/core/src/host-context.ts`

```typescript
export interface HostIdentity {
  readonly appName: string;
  readonly configDirName: string;
  readonly agentDirName: string;
}

export interface HostPaths {
  readonly globalConfigDir: string;
  readonly agentDir: string;
  readonly projectConfigDir: string;
}
```

The `HostContext` / `HostIdentity` / `HostPaths` types are minimal, well-named, and fully `readonly`. This is a textbook "parse, don't validate" seam — consumers receive typed paths, not strings to re-validate. No `any`, no type assertions, no `@ts-ignore`.

---

### Positive — Default behavior preserved in shell integration installer

**Location:** `packages/core/src/install-shell-integrations.ts:55-58`

```typescript
export function installShellIntegrations(input: string | InstallShellIntegrationsOptions = {}): InstallResult {
  const options = typeof input === 'string' ? { targetDir: input } : input;
  const targetDir = options.targetDir ?? getShellIntegrationsDir(options.hostContext);
  const sourceDir = options.sourceDir ?? getSourceDir();
```

`getShellIntegrationsDir()` still defaults to `~/.sandpiper/shell-integrations/` when no host context is passed. The union type for `input` preserves backward compatibility for existing callers passing a bare target path string. The new `sourceDir` option decouples from `PI_PACKAGE_DIR` without breaking the existing env-var-based flow.

---

### Positive — Good test coverage for the seam itself

**Location:** `packages/core/src/host-context.test.ts`

Four focused tests: explicit identity path resolution, agent dir override, session identity with explicit-vs-env precedence, and session identity from env fallback. Uses temp paths only, no real `~/.sandpiper` access.

---

### Positive — Command files consolidated session/env access

**Location:** `packages/sandpiper-standup-cli/src/commands/{cleanup,read,write}-cmd.ts`

All three command files replaced the same 3-4 lines of manual `cwd + join + process.env` logic with a single `resolveStandupCommandContext()` call. This eliminates per-file duplication, removes the unused `join` import from each command file, and routes session/env access through the typed `SessionIdentity` interface.

---

### Positive — design doc matches reality

**Location:** `.sandpiper/docs/specs/package-first-multi-distribution.md` (AGENT-86 section)

The verification checklist in the design doc matches actual results: `bun check` clean, all test suites pass, and the `rg` search for remaining sandpiper-specific references produces only the expected matches documented in the inventory. The seam is correctly placed — the **mechanism** is abstracted, while the **identity** is still declared by consumers.

---

### Minor — Dead `packageDir` parameter on `getSourceDir()`

**Location:** `packages/core/src/install-shell-integrations.ts:38`

```typescript
function getSourceDir(packageDir = process.env.PI_PACKAGE_DIR): string | undefined {
  if (!packageDir) return undefined;
  return join(packageDir, 'extensions', 'shell-relay', 'shell-integration');
}
```

The function signature accepts a `packageDir` parameter (added in AGENT-115), but the function is private and is only called from one place:

```typescript
const sourceDir = options.sourceDir ?? getSourceDir();
```

No caller ever passes a `packageDir` argument. The parameter is dead code — it exists only for hypothetical future use. The original signature (`function getSourceDir()`) was equivalent and simpler. Consider reverting to the zero-parameter form until a real caller needs it.

**Severity: minor** — dead parameter, no runtime impact. Violates YAGNI.

---

### Minor — `resolveStandupCommandContext` at CC 16, near complexity boundary

**Location:** `packages/sandpiper-standup-cli/src/commands/helpers.ts:42-58`

At CC 16 (1 above the 15 threshold), this function is doing slightly more than a single responsibility. It resolves the root directory, resolves the full host context, builds the standup path, and resolves session identity. This is all coherent — it's a "command context factory" — and the CC score is inflated by the pure-data construction with conditionals for `rootDir ?? cwd`. If this grows further (e.g., when identity becomes parameterized rather than hardcoded `SANDPIPER_STANDUP_IDENTITY`), it would be a natural split point. For now it's fine.

**Severity: minor** — monitor, no action needed yet.

---

### Nit — `--uuid`/`--file` flag help text hardcodes Sandpiper env var names

**Location:** `packages/sandpiper-standup-cli/src/commands/write-cmd.ts:9-10`

```typescript
.option('-u, --uuid <uuid>', 'Session UUID (defaults to SANDPIPER_SESSION_ID)')
.option('-f, --file <path>', 'Session file path (defaults to SANDPIPER_SESSION_FILE)')
```

The env var names are now only referenced in one authoritative place (`SANDPIPER_SESSION_ENV_NAMES` in helpers.ts), but these user-facing flag descriptions still mention them by name. If the env var names were ever to change (e.g., in a multi-distribution future), these help strings become stale. This is forward-looking — not a bug today — but worth noting since this change is about abstracting away from sandpiper-specific names.

**Severity: nit** — documentation string is accurate today, but creates coupling between help text and env var names.

---

### Nit — Error messages still hardcode env var names

**Location:** `packages/sandpiper-standup-cli/src/commands/write-cmd.ts:23,29`

```typescript
console.error('Session UUID required. Provide --uuid or set SANDPIPER_SESSION_ID environment variable.');
console.error('Session file path required. Provide --file or set SANDPIPER_SESSION_FILE environment variable.');
```

Same forward-looking concern as above. If the standup CLI is ported to a different agent distribution, these user-facing error messages would need updating.

**Severity: nit** — informational for future capability-package work.

---

## Structural Assessment

**API surface:** The new public exports (`HostIdentity`, `HostPaths`, `HostContext`, `SessionIdentity`, `SessionIdentityEnvNames`, `resolveHostContext`, `resolveSessionIdentity`) are clean and minimal. The `installShellIntegrations` function's union type for `input` is a pragmatic backward-compatibility pattern for internal consumers.

**Coupling:** The change **reduces** coupling. Before, each command file had a hard dependency on `.sandpiper` path construction. Now the command files are indifferent to the path structure — they receive `context.standupPath` and use it.

**Cohesion:** The new code is well-placed. `host-context.ts` lives in `packages/core` alongside other shared infrastructure (`env.ts`, `paths.ts`, `migrate-pi-configs.ts`). The standup-specific wiring (`SANDPIPER_STANDUP_IDENTITY`) lives in `helpers.ts` within the standup CLI package — correct layering.

**Test quality:** Tests verify behavior, not implementation. `host-context.test.ts` tests path construction and session identity resolution through the public interface. `helpers.test.ts` tests the standup command context factory end-to-end. The `install-shell-integrations.test.ts` test for explicit `sourceDir` is a good boundary test — it verifies the option works without relying on `PI_PACKAGE_DIR`.

**Remaining sandpiper-specific references (from verify search):** The only remaining `.sandpiper` or `SANDPIPER_` references in non-test source files are:
- `env.ts` — Sandpiper/Pi namespace mirroring (by design)
- `migrate-pi-configs.ts` — migration from Pi to Sandpiper (by design)
- `startup-context.ts` — task/project discovery (deferred to later task, per design doc)
- `system-prompt.ts` — system prompt text (by design)
- `install-shell-integrations.ts` — default well-known location (now overrideable, default preserved)
- `helpers.ts` — Sandpiper identity constants (correctly parameterized, the consumer chooses them)
- `index.ts` / `write-cmd.ts` — user-facing help/error text (noted in nits above)

This matches the inventory in the design doc exactly. The seam is correctly placed — the **mechanism** is abstracted, while the **identity** is still declared by consumers.

---

## Suggested Follow-up

- [ ] Revert the unused `packageDir` parameter on `getSourceDir()` to the zero-parameter form.
- [ ] (Future) When the standup CLI gains parameterized identity, consider making env-var names and help text derive from `SANDPIPER_SESSION_ENV_NAMES` rather than being hardcoded strings.
- [ ] (Future) Phase 3 (AGENT-87) — split identity from capabilities per the design doc.
