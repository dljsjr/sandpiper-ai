# Devtools

Development scripts and build utilities. Not distributed with the package.

## Scripts

| Script | Purpose |
|--------|---------|
| `postinstall.sh` | Assembles the `dist/` distribution (rsync, symlinks, dash build; legacy Pi package install is opt-in) |
| `preinstall.sh` | Scaffolds `dist/` directory structure before workspace builds |
| `vendor.sh` | Downloads vendored third-party skills from `vendor.txt` |
| `fetch-git-subdir.sh` | Downloads a subdirectory from a git repo (used by `vendor.sh`) |
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
| `postinstall-excludes.txt` | rsync exclude patterns for dist assembly (strips dev-only files like tests, tsconfig, etc.) |
| `vendor.txt` | Third-party skill sources for vendoring |

## mcporter

[mcporter](https://github.com/nicholasgasior/mcporter) generates standalone CLI wrappers for MCP (Model Context Protocol) servers. We use its `generate-cli` command to produce executable scripts that talk to MCP servers without requiring the user to manage server processes.

Current uses:
- **`dash`** — CLI for the [Dash](https://kapeli.com/dash) documentation browser MCP server. Built during `postinstall` and distributed with the package at `dist/skills/sandpiper/dash/scripts/dash`. mcporter's Node bundle is emitted as `dash.cjs`; the extensionless `dash` entrypoint is a tiny ESM wrapper so it still works under package roots with `"type": "module"`.
- **`ascii-motion`** — CLI for the ascii-motion MCP server (separate effort, not part of the distribution).

Server definitions live in `config/mcporter-dist.json` (for distribution builds) and `config/mcporter.json` (for local development, if present).

## Distribution Checks

`bun run test:distribution` is the package-first refactor's primary gate. It builds the generated artifacts before running the distribution, standalone, and Claude plugin smokes; `bun test` alone does not exercise this assembled layout.

Run the distribution invariant and smoke gate with:

```bash
bun run test:distribution
```

This prepares the generated Sandpiper Pi/npm package at `dist/`, verifies source-boundary invariants, checks generated Pi package resource paths, verifies npm/Pi package install metadata and scratch-file pruning, verifies root Pi package loading without Sandpiper identity, runs both dogfood standalone and compiled standalone app smoke tests with temporary agent directories, and validates the Claude plugin artifact plus hook smoke tests.

## Build Flow

```
bun install
  → preinstall.sh (scaffold dist/)
  → workspace preinstall (bun build each package)
  → bun links dependencies
  → postinstall.sh:
      → rsync sources and public docs into dist/
      → copy workspace dist/ outputs
      → wire skill-bundled CLIs (tasks, standup)
      → copy extension package.json files
      → remove stale nested generated artifacts from dist/
      → generate dist/package.json with npm-compatible package metadata and artifact-owned Pi resource metadata
      → symlink pi internal assets, including `dist/dist -> .` for Pi's double-dist asset lookup
      → build dash CLI via mcporter
      → create dev-mode skill binary symlinks
      → optionally run sandpiper install dist/ when SANDPIPER_INSTALL_PI_PACKAGE=1

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

## Recursive `dist/dist` Symlink

`postinstall.sh` creates `dist/dist -> .` intentionally. Pi's internal asset lookup expects paths like `<PI_PACKAGE_DIR>/dist/modes`; when `PI_PACKAGE_DIR` is already `dist/`, the self-symlink makes that double-dist lookup resolve to `dist/modes`.

Do not use recursive filesystem walkers that follow symlinks under `dist/` without a depth limit. Prefer `rg`'s default no-follow behavior, or use `find -P`/bounded `-maxdepth` when inspecting generated artifacts.

## Ecosystem Install Checks

`devtools/ecosystemPackage.test.ts` is the release/install compatibility gate. It checks that:

- the repository root contains no `catalog:` dependency specs, uses `workspace:*` only for root local workspace dependencies, uses exact versions for registry dependency specs, and any root Pi package routing points only at provider/package-owned paths;
- the generated Sandpiper Pi/npm package under `dist/` has npm-compatible manifests, no `private`, valid `file:` dependency targets, and no leaked scratch logs/PIDs;
- the root `dist/` package uses a `files` whitelist so nested generated artifacts are not included by `npm pack`.

`devtools/claudeCodePlugin.test.ts` covers Claude's side of the same gate: the generated plugin package metadata is publishable, `.claude-plugin/plugin.json` and root `.claude-plugin/marketplace.json` validate with the Claude CLI when available, and `npm pack --dry-run` includes the plugin manifest.
