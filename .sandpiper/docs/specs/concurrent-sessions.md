# Concurrent sessions

Sandpiper exposes the active session to child processes and skills independently of project continuation notes. Journal is a standalone optional package. Its writers coordinate through kernel locks, not session liveness.

## Session environment variables

`packages/core/src/session-continuity.ts` exports `setSandpiperSessionEnv`. The system extension calls it on every `session_start` with the active session's ID and session file, and passes `process.env`.

- `SANDPIPER_SESSION_ID` is set to the session ID.
- `SANDPIPER_SESSION_FILE` is set to the session file path. When the session has no file, the variable is removed so it never points at a previous session's file.

The values stay set for the whole process, so every child process and every tool inherits them. Pi's own `PI_SESSION_ID` and `PI_SESSION_FILE` reach only commands that Pi's bash tool runs. They never enter `process.env`, so the extension assigns the `SANDPIPER_` names itself. Skills read `SANDPIPER_SESSION_FILE` to find the session transcript.

Sandpiper writes no per-session state files. It keeps no registry of running sessions and does not track session liveness. These values do not determine which Journal entries survive.

## Project continuation context

Sandpiper defaults `AGENT_JOURNAL_DIR` to the absolute launch cwd's `.sandpiper` before loading Pi or child processes. Explicit values remain unchanged. Changing a child's cwd does not change this default.

The installed Journal skill owns reads and publications. For another project, use its resolved script with an explicit absolute `--dir <project>/.sandpiper`. Journal does not infer authors from session IDs or process IDs.

Concurrent Journal writers use a persistent lock file and atomic replacement. Sandpiper does not implement or bundle that algorithm. Historical project notes remain unchanged.

## References

- [Journal usage and directory selection](../../../docs/features/journal.md)
- [Session continuity playbook](../../playbooks/features/session-continuity.md)
- Runtime tests: `packages/core/src/session-continuity.test.ts`
