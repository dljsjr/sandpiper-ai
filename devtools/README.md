# Devtools

Development scripts and build utilities. Not distributed with the package.

## Scripts

| Script | Purpose |
|--------|---------|
| `assembleDistribution.ts` | Assembles the generated `dist/` Sandpiper Pi/npm package with copied resources, package outputs, Pi runtime assets, Dash helper CLI, and npm metadata |
| `vendor.ts` | Downloads vendored third-party skills from `vendor.txt` |
| `distPackageJson.ts` | Generates `dist/package.json` with artifact-owned Sandpiper `piConfig` + `pi` resource paths |
| `standaloneSandpiperApp.ts` | Assembles `dist/standalone-sandpiper/` metadata/resources and compiles the standalone app-bundle executable |
| `claudeCodePlugin.ts` | Assembles `dist/claude-plugin/` resources/manifest and bundles Claude hook scripts |
| `distribution-invariants.ts` | Shared helpers for distribution invariant and manifest smoke tests |
| `ecosystemPackage.ts` | Shared helpers for npm/Pi/Claude install-compatibility checks |
| `piPackageArtifactMetadata.ts` | Shared manifest/dependency generation for npm-installable Pi package artifacts |
| `clean.ts` | Portable workspace clean (removes node_modules, dist, caches) |

## Configuration

| File | Purpose |
|------|---------|
| `config/mcporter-dist.json` | mcporter server definitions for CLI generation |
| `vendor.txt` | Third-party skill sources for vendoring |

## mcporter

[mcporter](https://github.com/nicholasgasior/mcporter) generates standalone CLI wrappers for MCP (Model Context Protocol) servers. We use its `generate-cli` command to produce executable scripts that talk to MCP servers without requiring the user to manage server processes.

Current uses:
- **`dash`** — CLI for the [Dash](https://kapeli.com/dash) documentation browser MCP server. Built during distribution assembly and distributed with the package at `dist/skills/sandpiper/dash/scripts/dash`. mcporter's Node bundle is emitted as `dash.cjs`; the extensionless `dash` entrypoint is a tiny ESM wrapper so it still works under package roots with `"type": "module"`.
- **`ascii-motion`** — CLI for the ascii-motion MCP server (separate effort, not part of the distribution).

Server definitions live in `config/mcporter-dist.json` (for distribution builds) and `config/mcporter.json` (for local development, if present).

## Distribution Checks

`bun run test:distribution` is the package-first refactor's primary gate. It builds the generated artifacts before running the distribution, standalone, and Claude plugin smokes; `bun test` alone does not exercise this assembled layout.

Run the distribution invariant and smoke gate with:

```bash
bun run test:distribution
```

This prepares the generated Sandpiper Pi/npm package at `dist/`, verifies source-boundary invariants, checks generated Pi package resource paths, verifies npm/Pi package install metadata and scratch-file pruning, installs an npm-packed Sandpiper artifact with lifecycle scripts disabled, verifies root Pi package loading without Sandpiper identity, runs both dogfood standalone and compiled standalone app smoke tests with temporary agent directories, and validates the Claude plugin artifact plus hook smoke tests.

## Build Flow

```
bun install
  → install dependencies only

bun run prepare:distribution
  → turbo builds package-owned outputs
  → assembleDistribution.ts:
      → copy sources, package outputs, public docs, and README into dist/
      → copy generated helper CLIs into packaged skills
      → copy extension package.json files
      → generate dist/package.json with npm-compatible package metadata and artifact-owned Pi resource metadata
      → materialize Pi runtime assets under dist/dist/core and dist/dist/modes
      → build dash CLI via mcporter
      → create dev-mode skill helper copies in packages/resources

bun run prepare:standalone-app
  → copy standalone Sandpiper resources/support packages and public docs to dist/standalone-sandpiper/
  → generate Sandpiper sidecar package.json without Pi resource manifest entries
  → copy Pi internal asset directories required by the app-bundle layout

bun run build:standalone-app
  → run prepare:standalone-app
  → compile dist/standalone-sandpiper/sandpiper with the standalone Bun build plugin

bun run build:claude-plugin
  → run prepare:distribution for generated helper CLIs
  → copy Claude-compatible skills/commands/themes to dist/claude-plugin/ because installed Claude plugins must be self-contained
  → materialize generated skill scripts and bin helpers without external workspace symlinks
  → write .claude-plugin/plugin.json, package.json, and hooks/hooks.json
  → bundle hooks/autotoon-post-tool-use.js for Claude's PostToolUse lifecycle

bun run test:standalone-app
  → verify standalone app metadata/resource assembly
  → compile the app bundle and run help/resource smoke tests from temp agent directories

bun run test:claude-plugin
  → verify Claude plugin metadata/resource assembly
  → exercise the AutoTOON hook package and bundled hook artifact
```

## Pi Runtime Assets

Pi's config helpers look for built-in TUI themes and export templates under `<PI_PACKAGE_DIR>/dist/*`. The generated Sandpiper npm package sets `PI_PACKAGE_DIR` to the installed package root, so distribution assembly materializes Pi's `core/` and `modes/` assets under `dist/dist/` before packing. Do not replace these directories with symlinks; `npm pack` may drop symlinked publish-critical assets.

## Ecosystem Install Checks

`devtools/ecosystemPackage.test.ts` and `devtools/npmPackageInstallSmoke.test.ts` are the release/install compatibility gates. They check that:

- the repository root contains no `catalog:` dependency specs, uses `workspace:*` only for root local workspace dependencies, uses exact versions for registry dependency specs, and any root Pi package routing points only at provider/package-owned paths;
- the generated Sandpiper Pi/npm package under `dist/` has npm-compatible manifests, no `private`, valid `file:` dependency targets, no leaked scratch logs/PIDs, and all publish-critical runtime files included by `npm pack`;
- an npm-packed artifact installs globally with lifecycle scripts disabled and runs from a read-only package directory;
- the root `dist/` package uses a `files` whitelist so nested generated artifacts are not included by `npm pack`.

`devtools/claudeCodePlugin.test.ts` covers Claude's side of the same gate: the generated plugin package metadata is publishable, `.claude-plugin/plugin.json` and root `.claude-plugin/marketplace.json` validate with the Claude CLI when available, and `npm pack --dry-run` includes the plugin manifest.
