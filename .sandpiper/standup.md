# Session Stand-Up: 2026-03-24

## Accomplished

### Shell Relay UX Polish (SHR-51, SHR-52, SHR-55, SHR-60, SHR-61)
- Clear pane after env var injection to hide export noise (`; clear`)
- Replaced Enter keybind with `fish_preexec` dynamic wrapper — zero commandline manipulation
- Strip OSC terminal query sequences from captured output (`ansi.ts`)
- Skip unbuffer-relay for non-head pipeline commands (`test -t 1`)
- Task archival command for completed tasks (`task archive`)

### Build System Overhaul
- Simplified `pi_wrapper.ts`: `findPackageDir` walks up for `pi` key, `PI_SKIP_VERSION_CHECK=1`
- Added `system.ts` extension for sandpiper identity + update notifications
- Fixed extension discovery: copy package.json into dist, preserve `dist/` structure
- Symlink pi's `modes/` and `core/` into dist for theme/asset resolution
- `dist/dist → .` self-symlink handles pi's double-dist path expectation
- Portable pi package resolution (node, not bun-specific)
- Idempotent postinstall (remove dev symlinks before rsync)
- Split `tsc` out of workspace preinstall (fixes single-pass `bun install`)

### tsconfig/package.json Cleanup
- Deduplicated devDependencies across workspaces (hoisted from root via catalogs)
- `piConfig` single source of truth in root package.json
- Portable `clean` script (`devtools/clean.ts`)
- Fixed `@sinclair/typebox` path resolution
- Tests now type-checked (removed `*.test.ts` from tsconfig excludes)

### Fish Escaping Fix
- Replaced `string escape --style=script` with fish-compatible quote-break (`'"'"'`)
- Fish single quotes have NO escape sequences — `\'` is not valid

### Companion Script Path Fix
- `extensionRoot = dirname(__dirname)` for ghost-attach and unbuffer-relay
- Graceful spawn error handling in GhostClient (no more agent crash)

### Custom Update Notifications (TOOLS-8)
- Suppress pi's built-in version check
- Check npm registry for pi-coding-agent updates on session_start
- Sandpiper check stubbed pending npm publication

### New Projects Created
- PKM-1: Personal Knowledge Management with Zettelkasten semantics
- MEM-1: Cross-session memory/brain system
- WEB-1: Headless web browsing and automation tool

### Session Stand-Up Skill
- Authored `skills/sandpiper/standup/SKILL.md` for session continuity
- Simplified to single file at `.sandpiper/standup.md` (overwrite, not accumulate)

## In Progress
- Nothing left in progress — all work committed

## Next Session
1. **SHR-63** (MEDIUM) — Fix first-command race condition after setup
2. **SHR-62** (MEDIUM) — Investigate write-chars line wrapping for long commands
3. **PKM-1** — Start designing the note-taking system (could MVP as pure skill)
4. **TCL backlog** — design work (project metadata, archival strategy, atomicity)
5. **Build system** — `bun install` double-pass is a known bun bug; revisit if upstream fixes

## Blockers
- `pi.sendUserMessage()` doesn't route through slash command pipeline (upstream pi bug)
- `bun install` requires two passes for bin linking on clean install (upstream bun bug)
- Sandpiper not published to npm yet — blocks self-update notification

## Context
- **jj history is curated** — squashed iterative commits into logical units
- **67 tasks archived** — ran `task archive` to clean the backlog
- **`dist/dist → .` symlink** is intentional and critical — don't delete it
- **Extension discovery** requires `package.json` in dist copy (explicitly copied in postinstall)
- **Fish escaping**: `'"'"'` not `'\''` — fish has NO escape sequences in single quotes
- **Working tree is clean** — all changes committed via jj
