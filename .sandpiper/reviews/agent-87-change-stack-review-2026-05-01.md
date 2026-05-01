# Code Review: agent-87 Workspace Change Stack

**Date:** 2026-05-01
**Reviewer:** sandpiper (automated)
**Mode:** Diff Review
**Workspace:** `agent-87`
**Change IDs:** `pomtnkkq` → `kwxyvusn`

---

## Health Summary

| Metric | Value |
|---|---|
| Files changed | 13 |
| New files | 3 (`capabilities.ts`, `capabilities.test.ts`, `extension-factories.test.ts`) |
| Net delta | +425 / -50 lines |
| Linter | 0 errors, 0 warnings (199 files checked) |
| TypeScript | 0 errors (`tsc --noEmit` clean) |
| All tests | 23 passed |

## Intent

AGENT-87, part of the "package-first multi-distribution" roadmap. Split the monolithic `extensions/system.ts` extension into identity-aware factory groups so that:

1. A **neutral Pi package** can load background process tools without Sandpiper identity flags, prompt hooks, migration controls, diagnostics, or update banners.
2. A **Sandpiper package** still gets all identity behavior registered exactly once.
3. The **legacy `system.ts`** still works unchanged.
4. The **standup CLI** no longer hardcodes `SANDPIPER_SESSION_*` strings in help/error text.

### Commit Trajectory

- `pomtnkkq` — inventory doc
- `svnulyzw` — standup identity text (helpers + write-cmd)
- `szqsuowr` — split factories + system.ts collapse
- `syovvoou` — wire identity-aware extension sets + README + smoke test
- `kwxyvusn` — verification doc

## Invariant Verification

- [x] `rg "migrate-pi-configs|install-shell-integrations|before_agent_start|buildSandpiperSystemPrompt" extensions/capabilities.ts packages/cli/sandpiper_resources.ts` — zero matches
- [x] `rg "SANDPIPER_SESSION_ID|SANDPIPER_SESSION_FILE" packages/sandpiper-standup-cli/src/commands/write-cmd.ts` — zero matches
- [x] `bun check` — 0 errors, 0 warnings
- [x] All test suites pass

## Findings

### Positive

**P1 — Clean factory pattern with testable seams.** `extension-factories.ts` has three factory functions, each taking optional overrides, each producing an `ExtensionFactory`. Tests can inject controlled `ProcessManager`, `runtimeState`, `dumpSystemPrompt`, and `checkForUpdates` — no need to mock `process.env` or file systems. Options default via `??`.

**P2 — Three-layer architecture correctly preserves backward compat.** `system.ts` → `createSandpiperSystemExtension()` (composed). `capabilities.ts` → `createNeutralCapabilityExtension()` (neutral). `sandpiper_resources.ts` → `createSandpiperExtensionFactories()` (distribution). Each layer builds on the same factories. The legacy `system.ts` is now 8 lines of glue.

**P3 — Smoke test validates the dedup guarantee.** `standalone_cli_smoke.test.ts` "loads installed third-party packages while avoiding duplicate legacy Sandpiper resources" creates a fake legacy `sandpiper-ai` package and verifies each flag appears exactly once. Catches the class of bug that factory-split refactors cause (double registration from old path + new path).

**P4 — Standup CLI parameterization is well-scoped.** `StandupSessionEnvNames` interface with `SANDPIPER_SESSION_ENV_NAMES` constant, plus four `format*` functions with optional `envNames` defaults. `write-cmd.ts` no longer hardcodes session env var names anywhere.

### Minor

**M1 — `createExtensionCapture` duplicated across three test files.** `capabilities.test.ts`, `extension-factories.test.ts`, and `sandpiper_resources.test.ts` each define a similar capture helper, differing only in which `ExtensionAPI` subset they stub. The `capabilities.test.ts` version is intentionally minimal (only `on` and `registerTool`), so this is intentional scope-knitting rather than a mistake. A shared test utility would reduce ~60 lines of duplication if the divergence grows.

**M2 — `createSandpiperSystemExtension` re-derives values already computed by sibling factories.** Lines 56-59 of `extension-factories.ts` duplicate the option-resolution logic from `createNeutralCapabilityExtension` (line 31) and `createSandpiperIdentityExtension` (lines 40-42). The composed factory could call the individual factories:

```typescript
export function createSandpiperSystemExtension(...): ExtensionFactory {
  const neutral = createNeutralCapabilityExtension(capabilityOptions);
  const identity = createSandpiperIdentityExtension(identityOptions);
  return (pi) => { neutral(pi); identity(pi); };
}
```

This would eliminate the duplicated resolution. Mitigating: the composed factory is explicitly "legacy" (backward compat only), and the duplication is 5 lines. The current version is unambiguous and correct.

**M3 — `readonly` on return types vs. `readonly` on interface fields (minor, consistency).** Factory functions return plain `ExtensionFactory[]`, not `readonly ExtensionFactory[]`. The spread expression already returns a fresh array so mutation-safety holds, but the return type annotation is more permissive than the codebase convention.

### Nit

**N1 — `readonly` consistency.** `SandpiperResourcePaths` uses `readonly string[]`. `StandupSessionEnvNames` uses `readonly string`. Factory return types use plain arrays. Could be tightened uniformly.

**N2 — Commander option descriptions.** `formatSessionIdHelp()` / `formatSessionFileHelp()` used directly as Commander option description strings — correct behavior, cleaner than the prior broken template literals.

## Verdict

**Ready to merge as-is.** This is a well-executed, surgical refactor. Invariants are verified, the factory pattern is clean and testable, backward compatibility is intact, and test coverage validates both positive and negative properties. M2 (composed factory dedup) would be a ~10-line simplification but is not a correctness issue.
