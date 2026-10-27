# Concurrent sessions

Sandpiper records session lifecycle state independently of project continuation notes. Journal is a standalone optional package. Its writers coordinate through kernel locks, not session liveness.

## Runtime lifecycle

`packages/core/src/session-continuity.ts` owns the runtime state and PID-file lifecycle. The system extension calls it on session start and shutdown.

On session start, it exports `SANDPIPER_SESSION_ID` and, when present, `SANDPIPER_SESSION_FILE`. It writes the process ID, creation timestamp, and cwd as three lines in the session PID file. When the session changes, it removes the previous session's PID file. On shutdown, it removes the current PID file and clears runtime state.

These values support runtime session identification and other features. They do not determine which Journal entries survive. Do not remove generic lifecycle infrastructure merely because the retired continuity helper used it.

## Project continuation context

Sandpiper defaults `AGENT_JOURNAL_DIR` to the absolute launch cwd's `.sandpiper` before loading Pi or child processes. Explicit values remain unchanged. Changing a child's cwd does not change this default.

The installed Journal skill owns reads and publications. For another project, use its resolved script with an explicit absolute `--dir <project>/.sandpiper`. Journal does not infer authors from session IDs or process IDs.

Concurrent Journal writers use a persistent lock file and atomic replacement. Sandpiper does not implement or bundle that algorithm. Historical project notes remain unchanged.

## References

- [Journal usage and directory selection](../../../docs/features/journal.md)
- [Session continuity playbook](../../playbooks/features/session-continuity.md)
- Runtime tests: `packages/core/src/session-continuity.test.ts`
