# Devtools

Development scripts and build utilities. Not distributed with the package.

## Scripts

| Script | Purpose |
|--------|---------|
| `postinstall.sh` | Assembles the `dist/` distribution (rsync, symlinks, dash build, pi package install) |
| `preinstall.sh` | Scaffolds `dist/` directory structure before workspace builds |
| `vendor.sh` | Downloads vendored third-party skills from `vendor.txt` |
| `fetch-git-subdir.sh` | Downloads a subdirectory from a git repo (used by `vendor.sh`) |
| `distPackageJson.ts` | Generates `dist/package.json` with merged piConfig + pi resource paths |
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

## Build Flow

```
bun install
  → preinstall.sh (scaffold dist/)
  → workspace preinstall (bun build each package)
  → bun links dependencies
  → postinstall.sh:
      → rsync sources into dist/
      → copy workspace dist/ outputs
      → copy extension package.json files
      → generate dist/package.json
      → symlink pi internal assets
      → build dash CLI via mcporter
      → create dev-mode skill binary symlinks
      → sandpiper install dist/ (register pi package)
```
