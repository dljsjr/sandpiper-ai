# Build simplification exploration

> Archived 2026-11-17 as the record of the TOOLS-92 exploration behind the TOOLS-30 build simplification. For the current build, read [Build system reference](../../docs/dev/build-system.md).

- Mode: Explanation
- Task: TOOLS-92, under TOOLS-30
- Status: Exploration results. No implementation approval.
- Toolchain tested: Bun 1.4.4, with the existing installed dependency tree

## Problem

The previous work removed unused delivery targets and bundled resources. It did not establish the smallest build for the application that remains.

The current application requires Bun. It has two commands, one runtime dependency set, and no bundled skills, prompt templates, or custom themes. The repository still treats the runtime as a separately assembled workspace product.

The target of this exploration is less build machinery. Directory deletion and fewer lines are not substitutes for preserving behavior.

## Recommendation

Use one product package at the repository root, one Bun build for both entrypoints, and ordinary `bun pm pack`.

Keep the current source-module boundaries. They do not require separate emitted JavaScript or a cached build graph. A product-package boundary does not require merging core, capability, and adapter code into one module.

The product package can own its binaries, `dist/`, public documentation, license, and declared runtime assets. The package manager can include those files directly. No resource or documentation staging step is necessary.

This target removes Turbo, separate core emission, all three production helpers under `devtools`, and the associated cache and staging state. It retains bundling to avoid shipping every file from additional runtime dependency packages.

The prototype used `sandpiper-ai` as its fixture package name. An implementation must preserve the existing consumer package name and bin names unless Doug approves a rename. The source checkout must also declare all build dependencies correctly. The prototype reused installed dependencies and did not prove a fresh dependency installation.

## What remains in devtools

The directory contains 26 non-Finder files. Most are tests, not build tooling.

| Group                   | Current contents                                                      | Disposition in the proposed target                                                                  |
| ----------------------- | --------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------- |
| Production helpers      | `clean.ts`, `packCli.ts`, `stageCliResources.ts`, totaling 151 lines  | Remove through the simpler package layout and build command                                         |
| Build regression tests  | Four top-level test files                                             | Keep packed-install coverage. Retire tests for removed caching and staging behavior                 |
| Runtime test support    | Fifteen integration files and one jj fixture                          | Keep isolation, mock-provider, RPC, print-mode, and skill-fixture coverage                          |
| Legacy AST-grep files   | `sgconfig.yml` and `astgrepRules/astgrep_reconfigure_cli_options.yml` | No current caller found. The rules rewrite Commander `requiredOption` calls. Candidates for removal |
| Directory documentation | `README.md`                                                           | Update to describe the surviving test infrastructure                                                |

Removing the build helpers does not justify deleting the integration lane. Moving that lane to a directory named `tests` changes its address, not its complexity.

### Resource staging

`stageCliResources.ts` currently copies documentation and any present owned resource categories. It also filters orphaned skill directories and hidden files.

No runtime resource definitions remain in `packages/resources`. Only package metadata and two README files remain. User and project resource discovery does not depend on staging these placeholders.

A root product package can include public documentation directly. Owned asset files for retained features can use the package file list. This removes the staging operation rather than translating it into a different script.

The explicit resource-root override and SDK custom-resource support remain separate runtime contracts. Removing an unused owned resource tree does not authorize removing those contracts.

### Packing

`packCli.ts` copies the CLI into a temporary directory, copies the root license, and links the hoisted dependency tree there.

With Bun 1.4.4, direct packing from the current CLI workspace included all bundled dependencies. A separate hoisted-workspace fixture reproduced that result. Neither test needed package-local `node_modules`.

Direct packing omitted the root `LICENSE`. A package-local symlink to that license was also omitted. Ordinary npm workspace packing omitted the bundled dependencies too.

Therefore, the current wrapper is not an unconditional requirement of Bun packing. Keeping the present split package layout still requires a license-file solution. Making the root the product package removes that mismatch. Earlier Bun versions remain untested.

### Cleaning and caching

`clean.ts` recursively removes dependency directories, caches, nested outputs, and build information. Most of that behavior serves the former multi-output build.

One declared output directory permits one explicit output cleanup. Deleting `node_modules` is not necessary for an ordinary application rebuild.

The recommended target has no Turbo cache restoration. The stale-output cache regression then disappears with the cache, not through a weaker test.

The direct prototype bundled 453 modules in 55 milliseconds. This is one measurement, not a benchmark. It supports questioning the need for a build cache at this scale.

### Core emission

The core package exports source TypeScript at runtime. The root TypeScript configuration also maps the core import to source.

The current composite build emits JavaScript, declarations, maps, and build information. No consumer of the emitted core JavaScript was found. A copied source tree type-checked and ran without any core `dist/` directory.

Removing emission still requires aligning declaration exports with the intended development contract. It does not require removing the host-neutral core boundary.

## Alternatives tested

| Target                                                    | Evidence                                                                            | Tradeoff                                                                                                   |
| --------------------------------------------------------- | ----------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------- |
| Keep the current layout and prune helpers                 | Direct Bun packing works. The missing license still needs a solution                | Small migration, but ownership and staging layers remain                                                   |
| One root product package with one Bun build               | Offline installation, read-only execution, diagnostics, and a user extension passed | Requires package-ownership and script changes. Preserves a bundled artifact                                |
| One root product package with direct TypeScript execution | The same installed smoke cases passed without generated application output          | Removes the application build entirely, but increases this prototype tarball from about 39.8 MB to 52.9 MB |

The source-package prototype included no first-party test files. Standard bundled dependencies included 190 TypeScript test files. These were dependency files, not application tests accidentally selected by the file list.

Raw TypeScript is viable here. It is not automatically the best artifact. Without application bundling, more complete dependency packages enter the tarball. Runtime dependency reduction can change that comparison later.

The source prototype also passed a CLI type-check without core output. Three warm help invocations averaged about 418 milliseconds for installed source and 389 milliseconds for the existing workspace bundle. This small sample does not establish a performance advantage.

## Runtime and toolchain boundaries

`mcporter` remains a live dependency of the Parallel search adapter. Its 62 source-map modules enter the current bundle. Replacing it with Pi-native MCP remains an unapproved design candidate, not a completed simplification.

JSDOM serves web fetch and the retained DuckDuckGo adapter. SQLite serves Tattler room logs and skill telemetry. These dependencies are not dead merely because a declaration-level scan reports them as unused in the CLI package.

The repository also installs mcporter, jscpd, hike, and lizard through mise. No current build command invokes them. Their developer use must be distinguished from application build requirements before removal. Historical user approval exists for installing the mcporter CLI for developer convenience.

Shell Relay is disabled in the builtin factory list but remains in the workspace. Its source, migration flags, documentation, and assets need an explicit capability decision. Package simplification does not authorize silently deleting them.

## Dormant Shell Relay installer

Doug clarified that Shell Relay is intentionally disabled because it does not work well. Deprecation is under consideration, not approved.

TOOLS-93 records the deferred capability decision. It is not a packaging repair or a blocker for the proposed build. Do not add shell assets or restore the installer as part of build simplification.

The current CLI advertises `--install-shell-integrations`. The default installer expects scripts under the product package's `extensions/shell-relay/shell-integration` directory.

The current tarball contains none of those scripts. The real installer returned `Shell integration source not found` against an extracted current tarball. The probe used an explicit temporary target and did not touch installed shell integrations.

The proposed bundled-root prototype also omits these assets. If Doug retains Shell Relay, its installer and assets need evaluation with that capability. If Doug retires Shell Relay, its exposed installer belongs in the retirement scope. Neither change is approved by this exploration. The current observation does not justify preserving the staging helper.

## Evidence and limits

All experiments ran in owned temporary directories. The source-package and bundled-root installations used npm offline, disabled install scripts, isolated agent directories, and read-only installation trees.

The passing cases cover version/help, prompt rendering without a live provider request, and a user extension importing the runtime Pi SDK. The bundled-root tarball also contains the license, public documentation, and patched Pi dependency. It contains neither application source folders nor an owned resource tree.

These probes are feasibility evidence. They do not replace the full regression suite, interactive TUI checks, native-dependency portability checks, custom resource cases, or package-management checks after implementation.

The current experiments used an existing installed dependency tree. They do not establish the minimum supported Bun version or a clean-install dependency declaration set. Existing stock-asset behavior was not re-tested as an interactive TUI in these prototypes.

The requested Sonnet sub-agent could not launch because this session had no terminal multiplexer. The model catalogue exposed only `claude-cli/claude-sonnet`, not a verified 5.5 entry. No independent sub-agent result is claimed.

Evidence directory: `/var/folders/zj/49vt4cds6l15fs_1frdvz89r0000gn/T/sandpiper-build-explore-NadbqC/`.

The directory contains both prototype scripts, JSON results, tarballs, and isolated installations. `pack-results.json` records direct workspace packing. `source-results.json` and `bundled-root-results.json` record installed execution. `shell-asset-probe.json` records the asset failure. A second hoisted-workspace packing probe lives under `/var/folders/zj/49vt4cds6l15fs_1frdvz89r0000gn/T/sandpiper-hoisted-pack-xp0mWG/`.

No application source, package manifest, build script, installed user configuration, archive, or replacement skill changed during this exploration.
