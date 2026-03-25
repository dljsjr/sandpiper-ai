# Session Stand-Up: 2026-03-25

## Accomplished

### Documentation Overhaul (PKM-2)
- Comprehensive READMEs for all significant directories (root, extensions, packages, devtools, skills, ast-grep)
- Correct descriptive/prescriptive split: READMEs for humans, AGENTS.md for agents
- Added project directory skill (`skills/sandpiper/projects/`) + `~/.sandpiper/agent/projects.toon` registry
- Root AGENTS.md: directive to read subdirectory README/AGENTS before working in new subdirectory
- AGENTS.md: added Session Continuity section (read standup + project directory at session start)
- SHR-64 filed: install shell integration scripts to well-known location

### Pi Config Migration Feature (AGENT-2, AGENT-5, AGENT-8, AGENT-11)

**Research completed:**
- Confirmed `session_directory` fires after flag values are populated — correct hook for early-exit CLI flags
- Confirmed `ctx.reload()` re-discovers files that didn't exist at startup (FileSettingsStorage re-runs existsSync on each reload)
- Confirmed pi's `registerFlag` API has no built-in flag dependency/requires support
- Confirmed `SANDPIPER_CODING_AGENT_DIR` is the correct env var (APP_NAME="sandpiper" → ENV_AGENT_DIR="SANDPIPER_CODING_AGENT_DIR")

**Implemented:**
- `packages/core/src/migrate-pi-configs.ts` — core migration logic (no pi imports):
  - `getOldPiAgentDir()` — respects `__PI_CODING_AGENT_DIR_ORIGINAL` captured by pi_wrapper
  - `getNewSandpiperAgentDir()` — reads `SANDPIPER_CODING_AGENT_DIR` directly
  - `detectUnmigratedConfigs(cwd)` — returns resolved paths needing migration
  - `parseMigrationScope(global, local)` — maps booleans to MigrationScope
  - `parseMigrationCommandArgs(args)` — parses `/migrate-pi` slash command args
  - `performMigration(mode, options)` — move or symlink with full error handling
- `packages/cli/pi_wrapper.ts` — captures `__PI_CODING_AGENT_DIR_ORIGINAL` before SANDPIPER_* remapping
- `extensions/system.ts` — registers flags, session_directory handler, slash command, warning banner:
  - `--migrate-pi-configs` / `--symlink-config` — move or symlink pi configs, then exit
  - `--pi-configs-global` / `--pi-configs-local` — scope modifiers (apply to both operations)
  - `session_directory` handler — early exit with success/error code
  - `/migrate-pi move|symlink [--pi-configs-global|--pi-configs-local]` — interactive migration with `ctx.reload()`
  - `session_start` warning banner via `setWidget('migration-warning', ...)` when unmigrated configs detected

**AGENTS.md additions:**
- General coding guidelines: don't duplicate code, be consistent, use top-level imports
- Path handling: prefer `join()`/`homedir()`/`resolve()` over string literals and manual tilde expansion

## In Progress
- Nothing — all work committed and history curated

## Next Session
1. **SHR-64** (MEDIUM) — Install shell integration scripts to well-known location (`~/.sandpiper/shell-integrations/`)
2. **SHR-63** (MEDIUM) — Fix first-command race condition after setup
3. **SHR-62** (MEDIUM) — Investigate write-chars line wrapping for long commands
4. **AGENT-1** — Broader pi config migration design (the current work was phase 1)
5. **PKM-1** — Start designing the note-taking system

## Blockers
- `pi.sendUserMessage()` doesn't route through slash command pipeline (upstream pi bug)
- `bun install` requires two passes for bin linking on clean install (bun issue #19782)
- Sandpiper not published to npm yet — blocks self-update notification

## Context
- **`packages/core`** now has real code — `src/migrate-pi-configs.ts` + barrel `src/index.ts`
- **`sandpiper-ai-core`** added to root `package.json` dependencies and `tsconfig.json` paths
- **`--pi-configs-global`/`--pi-configs-local`** naming rationale: applies to both `--migrate-pi-configs` AND `--symlink-config`, so "migrate" prefix would be misleading
- **`session_directory`** is the correct hook for CLI-only early-exit operations (fires after flag values populated, before session manager created)
- **jj history is curated** — four clean migration commits
- **Working tree is clean**
