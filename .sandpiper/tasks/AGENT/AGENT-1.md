---
title: "Migrate pi config from ~/.pi to ~/.sandpiper via extension CLI flags"
status: COMPLETE
resolution: DONE
kind: TASK
priority: MEDIUM
assignee: UNASSIGNED
reporter: USER
created_at: 2026-03-25T16:59:08.170Z
updated_at: 2026-03-26T04:27:53.816Z
---

# Migrate pi config from ~/.pi to ~/.sandpiper via extension CLI flags

Currently, the sandpiper CLI wrapper sets PI_PACKAGE_DIR to point at sandpiper's dist, which gives us the `sandpiper` command and `~/.sandpiper` config directories. However, pi still reads from `~/.pi/` for some settings and writes to `~/.pi/agent/sessions/` for session storage.

The goal is to use pi's extension CLI flag mechanism to fully migrate config to `~/.sandpiper`.

## How Pi Extension Flags Work

From the pi extension API and main.js:

1. **Two-pass arg parsing**: First pass loads extensions, second pass parses with extension flags
2. **Extension registers flags**: `pi.registerFlag(name, { type: 'boolean' | 'string', description, default })`
3. **Extension reads values**: `pi.getFlag('--name')` returns the value
4. **Values stored in runtime**: `extensionsResult.runtime.flagValues` Map

## Implementation Options

### Option A: session_directory hook + CLI flag
- Register a `--agent-dir` or `--config-dir` flag
- Use the `session_directory` event to redirect session storage
- Needs investigation: does PI_PACKAGE_DIR affect agent dir resolution?

### Option B: Environment variable + extension flag
- Sandpiper sets `PI_AGENT_DIR=/Users/.../.sandpiper/agent` (hypothetical env var)
- Extension reads the flag and validates

### Option C: Custom agent dir via pi internals
- Investigate how `getAgentDir()` works in pi
- May need to patch or override

## Open Questions
- Does pi support overriding the agent directory via env var or flag?
- Can the `session_directory` event fully redirect all session storage?
- Are there other paths that need migration (models.json, settings, etc.)?

## References
- `node_modules/@mariozechner/pi-coding-agent/dist/main.js` — two-pass arg parsing
- `node_modules/@mariozechner/pi-coding-agent/docs/extensions.md` — registerFlag, session_directory event
- `packages/cli/pi_wrapper.ts` — current sandpiper wrapper implementation

---

# Activity Log

## 2026-03-25T17:01:01.220Z

- **description**: added (37 lines)

## 2026-03-26T04:27:53.816Z

- **status**: NOT STARTED → COMPLETE
- **resolution**: DONE
