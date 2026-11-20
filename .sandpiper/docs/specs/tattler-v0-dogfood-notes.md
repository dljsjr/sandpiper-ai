# Tattler v0 Dogfood Notes

These notes are the curated active summary for the Tattler v0 validation spike.
The chronological session notes in
`../../archive/tattler-v0-dogfood-session-2026-05-19.md` are source material;
when the two files overlap, prefer this document for current guidance.

## Current Tattler v0 Direction

- Build v0 as the smallest useful validation slice, not the full Tattler MVP.
- Keep the Pi entrypoint at `extensions/tattler/index.ts`.
- Keep v0 explicitly marked as a validation spike, not a stable API.
- Do not extend into v1 architecture without preserving the existing
  core/runtime boundaries.
- Validate live same-host agent messaging before building the durable v1 system:
  stable identity, handles, agent directory, claim locks, handshakes, receipt
  logs, schemas, package split, durable logs, or broadcast.
- v0 now includes rudimentary on-disk identity files for dogfood ergonomics.
  Treat them as local session locators, not stable agent identity.
- Use UDS stream sockets and NDJSON-ish framing for v0.
- v0 discovery can be socket-liveness based: connect succeeds means the endpoint
  is alive enough to list; it does not prove identity or protocol correctness.
- v0 message delivery should inject compact system notification prose, not raw
  transport metadata.
- Peer messages are context, not command authority. Receiving agents should
  weigh them against their current user/system instructions instead of blindly
  obeying another agent.

## Runtime Directory Decisions / Findings

- Runtime base selection remains:
  - prefer `XDG_RUNTIME_DIR` if set;
  - macOS fallback uses `tmpdir()` / `$TMPDIR`;
  - Linux fallback probes `/run/user/<uid>` without trying to create it;
  - final fallback uses `${TMPDIR:-/tmp}`.
- The final runtime dir should consistently append the harness/config namespace
  and create that final directory with mode `0700`.
- `process.title` was rejected as a harness namespace source because it is too
  process/runtime flavored.
- Deriving the namespace from `getAgentDir()` is lossy if the agent dir is
  overridden to an arbitrary path with no harness name.
- v0 currently uses an internal Pi import to read `CONFIG_DIR_NAME` because the
  upstream package does not currently expose the config dir/app namespace during
  an upstream refactor.
- Manual verification:
  - `pi` resolved `.pi` → `pi` → `$TMPDIR/pi`.
  - `sandpiper` resolved `.sandpiper` → `sandpiper` → `$TMPDIR/sandpiper`.
- Revisit for v1 when upstream exposes a stable config/app namespace.

## Tattler v0 Implementation Notes

- Wire frames must keep a serialized `format` string even if TypeScript types use
  symbols/generics for branding. The symbol can help internal type safety, but
  the JSON discriminant is the protocol contract.
- `sessionShortIdGenerator(sessionUuid)` expands UUID sections to find a short
  socket basename and eventually reaches the full UUID if needed.
- Socket collision handling currently probes existing socket files with a
  connect-based liveness check adapted from `agent-stuff` (`control.ts`,
  Apache-2.0).
- If a socket path exists and refuses connections, v0 unlinks it and reuses
  the path.
- If a socket path exists and does anything else, including not answering in
  time, v0 tries the next longer short id.
- `net.Server.listen()` is callback/event based, not Promise based. Awaiting
  `server.listen(...)` does not wait for bind completion; wrapping `listening` /
  `error` in a Promise is the right pattern.
- After a successful listen, break out of the short-id loop so the process does
  not bind additional longer socket names.
- On listen failure, close the server best-effort and continue/fail according to
  the intended fallback behavior.
- Rudimentary v0 identity files are written into the runtime directory so peers
  can list human-friendly names such as `Ninja` and `Samurai` while still routing
  by socket short id. Identity-file entries must be validated against a live
  socket path before listing them as peers.
- Dogfood exposed a startup failure mode where identity-file publication failed
  after the socket server started, leaving a socket alive without an identity
  file or registered tools. Treat this as a v0 startup bug/regression, and keep
  related failure modes visible during dogfood so half-alive sessions are easy to
  spot.
- Delivery (TAT-85). A message to an idle session starts a run. A message to a
  busy session waits in the pending inbox; the model gets one cue and may call
  `tattler_receive` to end its turn. Whatever is still pending when the run
  settles is delivered then, starting a new run, unless the user aborted the run
  and the model did not ask; those wait for the next prompt.
- Endpoint cleanup (TAT-84, TAT-87). `session_shutdown` closes the server and
  removes the socket file and the identity file; Pi runs it on quit, `/reload`,
  SIGTERM, and SIGHUP. An `exit` listener does the same on `process.exit`
  (Pi's `emergencyTerminalExit` and `uncaughtCrash`). The identity file is
  removed only while it still names this session's socket. After SIGKILL both
  remain, so each session start sweeps the runtime directory in the background:
  it removes socket files that refuse connections and identity files whose
  socket is missing or refuses, once they are at least 10 seconds old, so a
  session between bind and listen is never mistaken for a dead one. A socket
  that times out is kept.
- Self-repair (TAT-88). Once a second the session checks its files: it writes
  a missing identity file again, and listens again if its socket file is gone.
  A long-suspended session can refuse connections once its backlog fills, so
  another session's sweep may remove its files; this restores them when it
  runs again. A socket file at its path that is not its own is left alone.
- Limits checked before sending (TAT-88): an empty message, a message over 4096
  bytes, and a frame over 6144 bytes once JSON-encoded (quotes, backslashes,
  and line breaks count double) are refused with a clear error before the peer
  lookup. The server closes a connection that sends nothing for 10 seconds,
  and cuts error texts to 400 characters so replies fit the 2048-byte reply
  limit.
- Ownership (TAT-87). Startup reuses its socket path only when the old socket
  refuses connections; otherwise it grows the short id. A name whose identity
  file names another live session's socket stays with that session: the new
  session uses `session:<shortId>` and logs a warning, and the chosen name stays
  stored for a later start. Names that sanitize to the same file name count as
  the same name, and a name that sanitizes to nothing (such as `..`) is not
  used. The identity file is written to a temporary file and renamed into
  place.

## TAT-4 and Multi-Agent Dogfood Findings

- TAT-4 system notifications successfully wake receiving agents with structured
  `from`, `message`, and `messageId` data.
- The notification instructions now explicitly say that the user cannot see the
  peer message unless the receiving agent surfaces it. This fixed an ambiguity
  between hidden model context and user-visible transcript output.
- `messageId` in the notification data is useful for traceability during replies
  and debugging.
- A sustained Ninja/Samurai/Monk roleplay dogfood validated more than two actors:
  peer discovery, tool-routed sends, ACKs, notification wakeups, identity-file
  names, and third-party interleaving all worked.
- The Ninja/Samurai run also showed that peer messages did not override stronger
  local instructions. This is a desirable safety shape: Tattler delivers context;
  it does not grant peer messages command authority.
- Tool availability is part of the dogfood surface, not just transport. A session
  with a live socket but no identity file/tools is a half-alive failure mode that
  should be treated as a startup bug.

## Navigator Observations

The same session produced Navigator feedback, which is not about Tattler. It lives
in the Navigator repository at
`~/git/navigator/.sandpiper/docs/specs/navigator-dogfood-feedback.md`, tracked by
NAV-51 to NAV-55.

## Open Questions

- Should the v0 internal Pi config import be replaced by a hardcoded Sandpiper
  namespace for this plugin, or kept because it has been manually verified for
  both Pi and Sandpiper?
