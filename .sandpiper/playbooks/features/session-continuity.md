---
name: Session Continuity and Journal
read_when: journal, session continuity, concurrent sessions, SANDPIPER_SESSION_ID, SANDPIPER_SESSION_FILE, AGENT_JOURNAL_DIR, startup context, active session, handoff
---

# Session Continuity and Journal

If Journal is installed, load its skill before reading or publishing short continuation entries. Resolve its `scripts/journal` executable against the skill directory. Do not assume a global binary exists.

## Directory and Ownership

- Sandpiper defaults `AGENT_JOURNAL_DIR` to the absolute launch cwd's `.sandpiper` before Pi imports and child processes. Preserve every supplied value, including empty and relative values.
- For intentional cross-project work, use an explicit absolute `--dir <project>/.sandpiper`. Inherited environment values do not follow cwd changes.
- Journal owns its implementation and skill outside this repository. Do not bundle a copy or change its standalone `.agent-journal` fallback.
- Preserve saved historical notes. Do not migrate or delete their contents.
- Keep `SANDPIPER_SESSION_ID` and `SANDPIPER_SESSION_FILE` set for the whole process at every `session_start`. Sandpiper writes no session PID files and tracks no session liveness. Journal does not depend on either.

Read on resume. Publish one development as it occurs, with references for detail. Journal does not require a tracker or identity. If unavailable, use existing project records. YAAMS remains optional external memory.

Tests must use temporary notes and configuration directories, never real user notes, memory databases, or installed configuration.

## References

- Public usage and host directory contract: `docs/features/journal.md`
- Environment setup: `packages/cli/standalone_bootstrap.ts`
- Session environment variables: `packages/core/src/session-continuity.ts`
