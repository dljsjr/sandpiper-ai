# Tattler v0 Dogfood Session Notes — 2026-05-19

These are historical source notes from the first Tattler v0 / Navigator
dogfooding session. They preserve chronology and evidence from the session; use
`tattler-v0-dogfood-notes.md` as the curated current summary when the two files
overlap.

## Session Setup

- Sandpiper paired Navigator with Zed bridge `bridge-79648`.
- Navigator is watching `plugins/pi/extensions`.
- Agent editing is enabled, but the intended mode is mostly passive observation.
- Agent edits should be limited to maintaining this notes file unless explicitly
  asked otherwise.

## Starting Context

This section records the state at the start of the session. Later sections
supersede it where implementation or task status changed.

- Primary implementation file: `plugins/pi/extensions/tattler.ts`.
- TAT-2 remains in progress: receive-side `serverHandler` and ACK/error response
  handling are still the main missing pieces.
- TAT-3 is in `NEEDS REVIEW`: list/send tools exist, but `sendAgentMessage()`
  still needs timeout and close/end handling so the tool cannot hang forever on
  a silent or early-closing peer.
- TAT-11 is in `NEEDS REVIEW`: runtime directory fallback/resolution looked
  acceptable in the previous review.
- Next expected flow: harden send-side lifecycle, implement receive + ACK, then
  deliver received messages as compact system notifications.

## Terminology to Codify

- Distinguish **agent-authored messages** from **protocol messages** in Tattler
  design docs and code comments.
- Agent-authored messages are initiated by an agent through a tool call. The v0
  concrete message type is still `tattler.agent-message.v0`; future tool-driven
  message types may exist, but v0 currently has only this one.
- Protocol messages are generated deterministically by the extension/harness
  runtime without agent involvement. Current examples are ACK and ERR frames;
  the v1 handshake/greeting frame is another protocol-message example.
- Both categories use the same envelope and NDJSON-ish framing. There may not be
  a need to tag the categories on the wire, but naming the distinction explicitly
  should make the implementation easier to reason about.
- Avoid renaming the concrete `tattler.agent-message.v0` wire format casually;
  clarify the broader concept with terminology instead of changing v0 protocol
  names mid-spike.

## Dogfood Observations

- Navigator over-corrected toward agent-style surgicality during a human-driven
  refactor. The user pointed out that organization is not the same as cosmetic
  style churn when a single spike file is already over 500 LoC and new helpers
  are about to be added. Strong-style guidance should account for human driver
  cognition: a bounded organization commit can be part of the pass if it makes
  the next behavioral edit tractable.
- Useful distinction: keep organization work in a separate logical commit, but
  do not forbid it merely because it precedes the behavior fix. Scope it tightly:
  group existing helpers, avoid unrelated renames/format churn, and use section
  labels only if they improve navigation for the current driver.
- The orientation playbook wording around the inbox was ambiguous: it referenced
  `inbox.md` after mentioning `~/.sandpiper/agent/inbox/`, which led the agent
  to infer a nonexistent `inbox.md` child inside the inbox directory. AGENT-203
  clarified that the guidance file is the workflow playbook
  `~/.sandpiper/agent/playbooks/workflow/inbox.md`.

## Manual Socket Dogfood

- Manual fake peer `abc1234.sock` was briefly discovered, but `send_peer_message`
  could not send because the fake server exited after the liveness probe. This
  exposed an important v0 dogfood fact: liveness discovery consumes a connection,
  so one-shot tools like `nc` need keep-listening mode (`-k`) or equivalent.
- Manual fake peer `abcd1234.sock` stayed discoverable with `nc -k`. Sending to
  it returned an error instead of hanging:
  `Peer session:abcd1234 ended before acknowledging message ...`. This validates
  the early-close/EOF settlement path. It did not exercise the timeout path
  because the fake peer closed the connection rather than staying open silently.
- The manual peer did receive the outbound agent-authored frame:
  `{"format":"tattler.agent-message.v0","id":"019e4128-bddb-7082-8fcd-7d527f64a8be","message":"hello from Sandpiper Tattler v0 dogfood; expecting ACK timeout on this first run","from":"019e40c9"}`.
  This confirms the refactored client still writes the request frame before the
  early-close settlement error.
- Using `socket.end(frame)` on the client side caused `nc` to observe a write-side
  close / EOF and close the accepted connection before a manual ACK could be
  sent. Because v0 uses newline framing rather than EOF framing, the client send
  path was changed back to `socket.write(frame)` while relying on timeout and
  final cleanup to close the socket.
- After switching from `end(frame)` to `write(frame)`, sending to `abcd1234.sock`
  timed out as intended:
  `Timed out waiting for ACK from session:abcd1234 for message 019e4139-0dc9-712e-af04-09b54b0c6036`.
  This validates the ACK timeout path with a silent-but-open manual peer.
- With an extended timeout, manual ACK succeeded. The tool reported:
  `message 019e413c-7fc9-7538-8c14-14f9df4c4431 acknowledged by session:abcd1234`.
  This validates reply-line parsing, ACK correlation, and successful settlement.
- Manual ERR reply also behaved correctly. The tool returned an error for message
  `019e413d-2394-7527-a74e-b33024b8f9dd` with the peer-provided payload:
  `{ "code": "manual-test", "message": "manual error from nc", "correlatedMessageId": "019e413d-2394-7527-a74e-b33024b8f9dd" }`.
  This validates error reply parsing, error correlation, and rejected settlement.

## TAT-2 Receive/ACK Implementation Notes

- Server-side receive/ACK path is now implemented without notification delivery:
  it reads one newline-delimited incoming frame, treats empty EOF as a liveness
  probe, parses `tattler.agent-message.v0`, sends a correlated ACK on success,
  and sends `tattler.error.v0` on malformed or unsupported frames.
- The receive path uses `socket.iterator({ destroyOnReturn: false })` when reading
  the first incoming frame. This matters because returning early from a normal
  `for await...of socket` loop destroys the stream, which would prevent the
  server from writing the ACK after reading a complete newline-framed request.
- TAT-4 was implemented after this receive/ACK slice: parsed inbound messages
  are now acknowledged and delivered into the receiving agent session as compact
  system notifications.
- Manual inbound dogfood succeeded using `nc` as a client against
  `019e40c9.sock`:
  - Valid inbound `tattler.agent-message.v0` produced correlated ACK
    `019e418c-9715-750b-9b8d-0e05d883e0db` for message
    `b7796bc8-8f38-4e92-b8c2-4df201cca60d`.
  - Unsupported inbound `tattler.not-supported.v0` produced correlated protocol
    ERR `019e418d-791f-733c-8969-d8d6d2d27e87` with message
    `Unsupported incoming protocol frame format [tattler.not-supported.v0]`.

## Later Same-Day Dogfood Additions

- TAT-4 system notification delivery was validated with manual inbound messages
  and then with real agent-to-agent replies.
- The notification instructions were clarified to state that the user cannot see
  peer message content unless the receiving agent explicitly surfaces it.
- A rudimentary v0 identity-file layer was added for dogfood ergonomics. It gives
  peers names such as `Ninja` and `Samurai`, but remains a local session locator
  rather than stable identity/directory semantics.
- The type-level protocol refactor can use symbols/generics internally, but the
  wire format must retain the serialized `format` field.
- Identity-file peers must verify the referenced socket path is live before being
  listed. Otherwise stale `.id` files can make dead peers look available.
- Dogfood exposed a half-alive failure mode: a session can have a listening socket
  but no identity file or registered tools if startup fails after binding. This
  should remain visible during TAT-5 dogfood.
- Multi-agent roleplay stress testing with Ninja, Samurai, and a third-party Monk
  validated more-than-two-agent interleaving through `list_peers` and
  `send_peer_message`.
- Peer messages behaved as context rather than command authority: agents kept
  following stronger current-task instructions even after receiving unrelated
  third-party interleavings.

## Potential Follow-Up Items

- Continue watching for guidance-path ambiguity where a data directory and a
  playbook share a domain name.
- Continue capturing Navigator dogfood issues here as they happen, especially
  stale diagnostics, noisy watch events, and feedback timing/grounding problems.
