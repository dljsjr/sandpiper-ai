# Session Stand-Up: 2026-03-25

## Accomplished

### Documentation Overhaul (PKM-2)
- Comprehensive READMEs for all directories (root, extensions, packages, devtools, skills)
- Correct descriptive/prescriptive split: READMEs for humans, AGENTS.md for agents
- Project directory skill + `~/.sandpiper/agent/projects.toon` registry
- Session continuity + subdirectory discovery directives in root AGENTS.md
- Coding guidelines added to AGENTS.md: path handling, no duplication, consistency, top-level imports

### Pi Config Migration (AGENT-2, 5, 8, 11)
- `packages/core/src/migrate-pi-configs.ts`: performMigration(), detectUnmigratedConfigs()
- `pi_wrapper.ts`: captures `__PI_CODING_AGENT_DIR_ORIGINAL` before remapping
- CLI flags: `--migrate-pi-configs`, `--symlink-config`, `--pi-configs-global`, `--pi-configs-local`
- `/migrate-pi` slash command with tab completion + `ctx.reload()`
- Aggregated diagnostic banner via `setWidget('sandpiper-diagnostics')`

### Preflight Check System (AGENT-12, 13)
- `packages/core/src/preflight.ts`: registerPreflightCheck(), collectPreflightDiagnostics()
- Uses `pi.events` bus (shared across jiti instances) — module-level registry didn't work
- System extension aggregates all checks + built-in migration check into single banner

### Shell Integration Installer (SHR-64, 65, 66)
- `--install-shell-integrations` flag: copies scripts to `~/.sandpiper/shell-integrations/`
- Shell relay preflight check: probes `__relay_prompt_hook` via `fish -c 'functions -q ...'`
- `displayPath()` utility: `~` prefix for user-facing output
- TypeScript project references: `packages/core` → `composite: true`, shell-relay references it

### Bug Fixes
- `getFlag()` requires bare name (no `--` prefix) — pi docs are misleading, plan-mode example is correct
- `--if-present` for `bun --workspaces preinstall` (core has no preinstall)
- Source path fix: `extensions/shell-relay/shell-integration/` (was missing `extensions/` segment)
- Typo fix in system prompt: `~/.sandpiepr` → `~/.sandpiper`

### New Tickets Filed
- SHR-67: Error on relay tool use if integration not sourced (LOW, backlog)
- TCL-61: Wax single-file hybrid search engine spike (LOW, with mcporter integration note)

## In Progress
- Nothing — all work committed

## Next Session
1. **TCL-53** (MEDIUM) — Project-level metadata (markdown/toon config file per project)
2. **TCL-56** (MEDIUM) — Atomicity improvements (agent notes written — start with atomic writes, then index self-healing)
3. **WEB-1** (MEDIUM) — Headless web tool (evaluate lightpanda, Puppeteer, simple fetch)

## Blockers
- `pi.sendUserMessage()` doesn't route through slash command pipeline (upstream pi bug)
- `bun install` requires two passes for bin linking on clean install (bun issue #19782)
- Sandpiper not published to npm — blocks self-update notification

## Context
- **`pi.getFlag()` takes bare names** — no `--` prefix. The docs show `getFlag("--my-flag")` but that's wrong. Plan-mode example uses `getFlag("plan")`. All our flags are fixed.
- **`pi.events` for cross-extension communication** — module-level registries don't work across jiti instances. `pi.events` is the shared runtime event bus.
- **`packages/core` has real code now** — migrate-pi-configs, preflight, install-shell-integrations, paths. Uses `composite: true` tsconfig with project references from shell-relay.
- **Shell integration well-known path** — `~/.sandpiper/shell-integrations/relay.{fish,bash,zsh}`
- **Preflight probe** — fish doesn't need `-i` for `functions -q` (sources config.fish for all sessions including `-c`). Bash/zsh need `-i`.
- **TCL-56 approach written up** — recommends: atomic writes first (write-to-temp-rename), index self-healing second, skip file locking. Defer move journaling unless moves prove unreliable. Consider index spike results (TCL-55/61) before investing in index consistency.
- **Working tree is clean** — all changes committed via jj
