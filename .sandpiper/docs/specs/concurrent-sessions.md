# Concurrent Sessions Design

**Status**: Implemented
**Last Updated**: 2026-04-06

## Problem

The standup file (`.sandpiper/standup.md`) bridges context across sequential agent sessions. The original write rule was: "if the Session UUID in the existing standup matches yours, update in place; if it differs, overwrite." This works for sequential sessions but fails when two ephemeral sessions overlap in time — each sees the other's UUID as stale and overwrites the entire file. The last writer wins and the other session's context is lost.

## Solution

A `sandpiper-standup` CLI with PID-based liveness detection.

### Architecture

```
Extension (system.ts)          CLI (sandpiper-standup)
┌─────────────────────┐       ┌──────────────────────────┐
│ session_start:      │       │ read:                    │
│   create PID file   │       │   - clean dead sections  │
│                     │       │   - output active/       │
│ session_shutdown:   │       │     inactive sections    │
│   remove PID file   │       │                          │
│                     │       │ write:                   │
│                     │       │   - clean dead sections  │
│                     │       │   - write own section    │
│                     │       │                          │
│                     │       │ cleanup:                 │
│                     │       │   - remove dead sections │
│                     │       │   - remove dead PID files│
└─────────────────────┘       └──────────────────────────┘
```

**Extension responsibilities**:
- Create PID file on `session_start`
- Remove PID file on `session_shutdown`
- Call `sandpiper-standup read` to get cleaned context

**CLI responsibilities**:
- All standup file parsing and serialization
- PID-based liveness detection
- Section cleanup (removing dead sessions)
- Atomic file writes

### PID File Convention

```
$XDG_STATE_HOME/sandpiper/sessions/<uuid>.pid
```

Contents (three lines):
```
12345
2026-04-05T10:00:00.000Z
/Users/doug/git/my-project
```

- Line 1: OS process ID
- Line 2: ISO 8601 creation timestamp
- Line 3: Working directory

Fallback: `~/.local/state` when `XDG_STATE_HOME` is unset.

### Liveness Detection

The CLI checks process liveness using `process.kill(pid, 0)`:
- Success or `EPERM` → process is alive
- `ESRCH` → process is dead
- No PID file → session is dead

**PID reuse**: On modern systems with 4M+ PID spaces, reuse within a session's lifetime is extremely unlikely. A false positive (reused PID keeps a dead section alive) results in a stale standup section — mild noise, not data loss. The `created_at` timestamp is retained for future hardening if needed.

### Standup File Format

```markdown
# Session Stand-Up

## Session c82731d3 (Updated: 2026-04-05T10:30:00Z)

Session file: ~/.sandpiper/agent/sessions/--Users-doug-git-my-project--/2026-04-01T18-12-48-013Z_c82731d3.jsonl

### Accomplished
- Implemented login fix (Refs: SHR-1)

### In Progress
- Rate limiting endpoint

### Next Session
- Complete rate limiting middleware

### Blockers
- None

### Context
- Working copy has uncommitted rate limiter changes

## Session f19a4e2b (Updated: 2026-04-05T10:25:00Z)

Session file: ~/.sandpiper/agent/sessions/--Users-doug-git-my-project--/2026-04-05T10-20-00-000Z_f19a4e2b.jsonl

### Accomplished
- Code review of login fix

...
```

Key changes from legacy format:
- One section per active session, identified by `## Session <uuid>` header
- Each section has the same internal structure (Accomplished, In Progress, etc.)
- File contains only alive sections (dead sections are cleaned on read/write)

### Read Output Format

The `sandpiper-standup read` command outputs two sections:

```markdown
# Session Stand-Up

## Active Sessions

### Session c82731d3 (Updated: ...)
...

## Inactive Sessions

### Session f19a4e2b (Updated: ...)
...
```

- **Active Sessions**: Sections with live PIDs (or the current session)
- **Inactive Sessions**: Sections from recently-dead sessions (for context)

The file itself contains only active sections. Inactive sections are returned by `read` for display but not written back to the file.

## Usage

### Extension Layer

```typescript
// On session_start
writePidFile(sessionId, cwd);

// On session_shutdown
removePidFile(sessionId);

// Reading standup context (shell-safe: no string interpolation)
const standupContent = execFileSync('sandpiper-standup', ['read', '-d', cwd], { encoding: 'utf-8' });
```

### CLI Commands

```bash
# Read cleaned standup (outputs active + inactive sections)
sandpiper-standup read -d /path/to/project

# Write a section (reads body from stdin)
# Session identity comes from SANDPIPER_SESSION_ID and SANDPIPER_SESSION_FILE env vars (set by extension)
# Flags -u/--uuid and -f/--file are optional overrides
echo "### Accomplished\n- Work done" | sandpiper-standup write -d /path/to/project

# Clean up dead sessions and PID files
sandpiper-standup cleanup -d /path/to/project
```

## Migration

### Legacy Format

If the standup file has the old format (no `## Session` headers), the parser treats the entire content as a single section from an "unknown" session. On first write by a new session, the legacy content is wrapped in a `## Session unknown` header and the new session's section is appended. The legacy section is **preserved** on subsequent reads (to avoid destructive migration) and remains in the file until explicitly removed or replaced.

## Known Limitations

1. **PID reuse**: Extremely unlikely on modern systems, but possible. Consequence is a stale section, not data loss.
2. **Platform-specific process introspection**: Not implemented for MVP. `process.kill(pid, 0)` is cross-platform in Node.js.
3. **CLI availability**: Extension falls back to direct file read if CLI is not available.

## Future Work

- Multi-agent stable identity (workspaces, per-agent assignees) — documented in `multi-agent-concurrency-workplan.md` for future reference
- PID reuse detection via `pidusage` or similar (low priority)
- File-level advisory locking for concurrent modification protection

## Relationship to Other Work

- **v3 Task Storage**: Independent systems
- **Self-Reflect Concurrent Modification**: Addressed with operational guidance in the self-reflect prompt
- **Multi-Agent Stable Identity**: Parked for future persistent agent scenarios
