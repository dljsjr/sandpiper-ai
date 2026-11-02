# Implement the minimal Sandpiper build

- Mode: How-to plan
- Parent: TOOLS-30
- Exploration: TOOLS-92
- Status: TOOLS-94–98 are ready for user review. Integrated verification and independent read-only review are complete. User acceptance remains separate.
- Agent execution: Doug lifted the fling hold and authorized inherited-model workers.

## Target and boundaries

Implement the root-product-package design from the [exploration](build-simplification-exploration.md). Do not implement the no-build TypeScript alternative.

Use one root product manifest and one Bun build for both entrypoints. Pack the root product with ordinary `bun pm pack`. Remove Turbo, separate core emission, staging, the temporary pack wrapper, and the recursive cleaner.

Keep source modules in their current folders. Preserve the installed package identity `sandpiper-ai-cli`, its version and branding, and both command names. Preserve the existing `packages/cli/bin/` launcher paths. The user's workspace launcher can depend on those paths.

Do not create another compatibility wrapper to compensate for an unnecessary bin move. The root product can own the current bin directory directly.

### Shared implementation contract

| Concern                   | Contract                                                                                                                                                                          |
| ------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Product metadata          | Root `package.json` owns the CLI product. Remove the nested duplicate CLI product manifest. Preserve `piConfig` and the existing consumer identity                                |
| Runtime output            | One Bun invocation writes both entrypoints and shared chunks under root `dist/`                                                                                                   |
| Binaries                  | Root `bin` metadata keeps `packages/cli/bin/sandpiper` and `packages/cli/bin/sandpiper-system-prompt`. The shims locate root output                                               |
| Documentation and license | Pack the existing root-owned files directly. Do not copy them into an intermediate package                                                                                        |
| Resources                 | Both source and built modes use optional `<productRoot>/packages/resources`. The installed tree can omit it. Explicit resource-root overrides still require an existing directory |
| Pi                        | Ship the pinned, already-patched runtime dependencies. Set product and Pi asset paths before SDK imports                                                                          |
| Installation              | Keep dependency installation separate from application builds. Preserve offline consumer installation with scripts disabled                                                       |
| Toolchain                 | Align declarations with tested Bun packing behavior. Bun 1.4.4 passed the exploration. Do not infer compatibility with earlier versions                                           |

Custom resource support, ordinary settings, package-management behavior, and Journal defaults remain runtime contracts. Removing unused owned resource staging does not remove those contracts.

Shell Relay remains disabled. TOOLS-93 is a deferred capability decision, not a packaging repair. Do not add its assets, revive its installer, or remove the capability in this work.

Do not redesign web search, replace mcporter, remove developer tools, change external repositories or user configuration, install archived skills, or modify the WIP jj replacement.

Doug approved one narrow external exception after the new build and stable-bin checks passed: change the old `node_modules/.bin/sandpiper` target to `packages/cli/bin/sandpiper` in both the deployed launcher and its canonical dotfiles source. Preserve every other byte, argument-handling difference, and file mode. Leave unrelated dotfiles changes untouched.

## Work items

| Task     | Deliverable                                                | File ownership                                                                                                                               | Handoff                                                                                   |
| -------- | ---------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------- |
| TOOLS-94 | Root product manifest and single build/pack commands       | Root package/dependency metadata, lockfile, toolchain declarations, `turbo.json`, internal package metadata/type exports, existing bin shims | Runtime and test workers receive the final product, output, dependency, and bin contracts |
| TOOLS-95 | Root-aware runtime bootstrap                               | CLI bootstrap and its unit tests, source runtime/diagnostic entrypoints, directly required runtime modules                                   | Test worker receives source/built metadata and resource behavior                          |
| TOOLS-96 | Helper removal and packaging regressions                   | Production devtools helpers and their tests, CLI smoke/discovery/diagnostic/asset tests                                                      | Lead receives integrated source, built, installed, and payload evidence                   |
| TOOLS-97 | Active documentation and obsolete build-only cleanup       | Active docs, READMEs, project build playbooks, two unreferenced devtools AST-grep files                                                      | Lead receives documentation aligned with implemented commands                             |
| TOOLS-98 | Integration, independent review, and preservation evidence | Lead owns integration. Reviewer remains read-only                                                                                            | User receives implementation and review results separately from final acceptance          |

Do not edit another owner's files without a lead-coordinated handoff. TOOLS-94 also owns the new `devtools/rootProductMetadata.test.ts` for its manifest and bin contracts. The lead owns this plan, tracker coordination, Journal, commits, and integration builds.

## Execution order

1. Start TOOLS-94, TOOLS-95, and the documentation draft in TOOLS-97. Use model and thinking inheritance. Start with read-only preparation until the lead sends GO.
2. Hand off the package and runtime contracts to TOOLS-96. Finalize documentation against the implemented result.
3. Integrate all four work items under TOOLS-98. Run the complete checks and independent review before presenting acceptance results.

The dependency graph is:

```text
TOOLS-94 package/build -----+
                            +--> TOOLS-96 tests/helpers --+
TOOLS-95 runtime -----------+                             |
                                                          +--> TOOLS-98 integration/review
TOOLS-97 documentation ----------------------------------+
```

No sub-agent is launched or queued by this document. Initial worker names can be `package-build`, `runtime-layout`, and `build-docs`. Start a packaging worker after the first two handoffs. Assign an independent reviewer after integration.

## Acceptance criteria by work item

### TOOLS-94: package and build

Establish accurate build-time and installed runtime dependencies. Do not depend on undeclared packages that happen to exist in the current `node_modules` tree. Produce a consistent lockfile through the package manager.

Keep core and capability boundaries without requiring their emitted JavaScript or declaration directories for this application. Align their type exports with source use where needed.

The product file list must include its binaries, runtime output, public documentation, license, and explicitly retained assets. It must exclude archived resources and development state.

Keep the user's existing launcher path usable through the migration. Coordinate the bin switch with generation of usable root output.

### TOOLS-95: runtime layout

Test source and built module locations against the same real product root. Preserve the explicit package and resource overrides. Reject missing or file-valued explicit resource roots.

Keep default resource absence valid. Do not add checkout fallback, generated metadata, installation writes, new flags, or another sidecar.

Keep branding, version, Pi asset resolution, environment mirroring, and startup defaults intact. Set the environment before importing Pi.

### TOOLS-96: tests and helper removal

Delete `devtools/clean.ts`, `devtools/packCli.ts`, and `devtools/stageCliResources.ts` after their callers use the new product contract. Retire tests exclusively about removed Turbo or staging behavior.

Preserve output-cleanup coverage. The real build command must not leave obsolete chunks or retired payloads in the resulting artifact.

Inspect package contents before deleting resources in the installed smoke. Then test the resource-free case separately. This resolves the existing TOOLS-33 coverage finding without weakening the retirement assertions.

Keep coverage for both commands, patched Pi, stock and custom themes, configured custom skills/prompts, runtime SDK imports, explicit invalid overrides, and normal package behavior. Retain the RPC lane, mock providers, and jj isolation fixture.

### TOOLS-97: documentation

Describe one product, one output directory, explicit builds, ordinary packing, and dependency-only installation. Distinguish build dependencies from optional developer conveniences.

Remove active instructions for retired staging, caching, or compiled-executable work. Preserve historical records rather than rewriting them for a zero-match search.

Remove the two devtools AST-grep migration files only after confirming that they have no current caller. Keep active root AST-grep tooling.

### TOOLS-98: integration and review

Make sure that fresh dependency declarations support the build, not only the existing installed tree. Serialize workspace installs, output cleanup, full builds, and packed-install tests.

Run `bun check` with zero errors and warnings. Run the full Vitest suite, focused runtime cases, and the new pack command. Inspect the actual tarball and run it outside the checkout with isolated state.

Use offline installation with scripts disabled. Make the installation read-only for runtime checks. Do not invoke a real provider or a real shell integration installer.

Review the full diff for added indirection, accidental feature removal, dependency leakage, stale instructions, and complexity moved into shell commands. Recheck relevant preservation evidence for settings, archives, WIP skills, and independent copies.

Leave completed implementation tasks ready for user review. Do not automatically close TOOLS-30 or infer final acceptance from passing tests.

## Working rules and launch coordination

Complete one behavior's RED, GREEN, and refactoring assessment before starting the next test. Agents perform these cycles autonomously. No human approval is required for each cycle.

Shared-checkout workers must respect the file ownership table. Do not run concurrent installs or build commands that delete shared output. The lead schedules those operations and commits the integration.

Use jj, not git. Every snapshotting jj command needs the command-local `--config fsmonitor.backend=none` workaround. Do not change persistent configuration.

Doug fixed fling and lifted the execution hold. The lead starts the initial workers before authorizing edits. No worker can commit, mutate shared dependency installation, or run integration builds without a lead-coordinated handoff.

## Verification status

- All implementation workers and the independent reviewer have handed off and closed. TOOLS-94–98 are NEEDS REVIEW. The independent read-only review found no outstanding actionable findings or blockers; it made no edits or test runs.
- The integrated checkout passes `bun check`, all 85 Vitest files and 653 tests, and `bun run pack:cli`, with unchanged test timeouts and no lint warnings. An SDK-anchored regression proved the Jiti cache-fixture correction RED then GREEN; the four touched fixtures now disable filesystem caching.
- A fresh source copy passes frozen offline dependency installation with scripts disabled, the same checks and full test suite, and packing. Its lockfile stays unchanged; no legacy CLI, core, or capability output is present or emitted. Existing ignored output is left alone in the live checkout.
- Actual packing excludes a previous root tarball on repack and produces the identical payload. Empty-cache offline npm installation, read-only CLI/SDK/theme checks, and native SQLite and DOM probes pass without installed sidecars. This does not certify empty-cache Bun consumer installation.
- All nine protected roots match their baselines. Both launcher copies retain only the approved target change, and the three unrelated dotfiles retain their original bytes and modes. TOOLS-30 remains open; passing verification is not user acceptance.
