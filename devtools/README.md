# Devtools

Development scripts and build utilities. Not distributed with the package.

## Scripts

| Script | Purpose |
|--------|---------|
| `postinstall.sh` | Assembles the `dist/` distribution (rsync, symlinks, dash build; legacy Pi package install is opt-in) |
| `preinstall.sh` | Scaffolds `dist/` directory structure before workspace builds |
| `vendor.sh` | Downloads vendored third-party skills from `vendor.txt` |
| `fetch-git-subdir.sh` | Downloads a subdirectory from a git repo (used by `vendor.sh`) |
| `distPackageJson.ts` | Generates `dist/package.json` with merged piConfig + pi resource paths |
| `neutralPiPackage.ts` | Assembles `dist/neutral-pi-package/`, the neutral Pi package transition artifact |
| `standaloneSandpiperApp.ts` | Assembles `dist/standalone-sandpiper/` metadata/resources and compiles the standalone app-bundle executable |
| `distribution-invariants.ts` | Shared helpers for distribution invariant and manifest smoke tests |
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
- **`dash`** — CLI for the [Dash](https://kapeli.com/dash) documentation browser MCP server. Built during `postinstall` and distributed with the package at `dist/skills/sandpiper/dash/scripts/dash`.
- **`ascii-motion`** — CLI for the ascii-motion MCP server (separate effort, not part of the distribution).

Server definitions live in `config/mcporter-dist.json` (for distribution builds) and `config/mcporter.json` (for local development, if present).

## Distribution Checks

Run the distribution invariant and smoke gate with:

```bash
bun run test:distribution
```

This prepares the legacy `dist/` assembly, builds `dist/neutral-pi-package/`, verifies source-boundary invariants, checks generated Pi package resource paths, verifies neutral package loading without Sandpiper identity, and runs both dogfood standalone and compiled standalone app smoke tests with temporary agent directories.

## Build Flow

```
bun install
  → preinstall.sh (scaffold dist/)
  → workspace preinstall (bun build each package)
  → bun links dependencies
  → postinstall.sh:
      → rsync sources into dist/
      → copy workspace dist/ outputs
      → wire skill-bundled CLIs (tasks, standup)
      → copy extension package.json files
      → generate dist/package.json
      → symlink pi internal assets
      → build dash CLI via mcporter
      → create dev-mode skill binary symlinks
      → optionally run sandpiper install dist/ when SANDPIPER_INSTALL_PI_PACKAGE=1

bun run build:neutral-pi-package
  → copy neutral extension/resource subset to dist/neutral-pi-package/
  → generate neutral package.json without Sandpiper piConfig or sandpiper bin

bun run prepare:standalone-app
  → copy standalone Sandpiper resources/support packages to dist/standalone-sandpiper/
  → generate Sandpiper sidecar package.json without Pi resource manifest entries
  → copy Pi internal asset directories required by the app-bundle layout

bun run build:standalone-app
  → run prepare:standalone-app
  → compile dist/standalone-sandpiper/sandpiper with the standalone Bun build plugin

bun run test:standalone-app
  → verify standalone app metadata/resource assembly
  → compile the app bundle and run help/resource smoke tests from temp agent directories
```
