---
name: tattler
description: >-
  Work on Tattler, Sandpiper's local agent-to-agent messaging spike. Use when editing
  extensions/tattler/index.ts, discussing Tattler v0/v1, peer discovery, UDS
  sockets, ACK/ERR frames, agent-message wire format, identity files, agent directory,
  list_peers/send_peer_message tools, multi-agent dogfood, or TAT-* Tattler tasks.
---

# Tattler Development and Dogfood

Use this skill for Tattler implementation, review, debugging, and dogfood inside
this repository. Tattler v0 is intentionally a validation spike; keep the useful
constraints sharp so it does not accidentally become the v1 architecture.

## Start Here

Before changing code, read the relevant project playbooks from the repo root:

- `.sandpiper/playbooks/development/pi-extensions.md` for Pi extension API usage.
- `.sandpiper/playbooks/development/typescript-and-tests.md` for TypeScript,
  linting, and verification.
- `.sandpiper/playbooks/features/session-continuity.md` if the work involves
  multiple live sessions or resumed sessions.

For current Tattler context, read:

- `.sandpiper/docs/specs/tattler-v0-dogfood-notes.md` for the curated active
  summary.
- `.sandpiper/archive/tattler-v0-dogfood-session-2026-05-19.md` only when
  reviewing original dogfood chronology/evidence or preserving findings from it.

For v1 architecture work, route to the broader design/task surfaces instead of
stretching v0 guidance:

- `.sandpiper/archive/mailbox-coordination-architecture-notes.md`, the completed
  AGENT-201 review whose decisions TAT-6 reconciles with the spike findings.
- `TAT-6` for drafting the v1 mini-spec.
- `TAT-7` for stable identity and directory.
- `TAT-8` for runtime claims and handshake receipts.
- `TAT-9` for package split / thin Pi binding.

## Current v0 Boundaries

Treat v0 as a same-host, live-session validation slice:

- Keep `extensions/tattler/index.ts` as the Pi entrypoint unless
  the user explicitly asks to start the v1 extraction. The inbox, IPC,
  protocol, identity, room log, and receive logic live in the `tattler-*.ts`
  modules beside it.
- Prefer small behavior slices over package architecture, durable logs,
  broadcast, stable identity, or handshake work.
- Treat short IDs and `.id` identity files as local session locators, not stable
  agent identity. Stable agent identity/directory belongs to TAT-7/v1.

## Protocol Invariants

- v0 uses UDS stream sockets with one newline-delimited JSON frame per exchange.
- Wire frames must include the serialized `format` string; type-level branding
  may exist, but it must not replace the JSON discriminant.
- Current agent-authored wire type: `tattler.agent-message.v0`.
- Current protocol-generated wire types: `tattler.ack.v0` and
  `tattler.error.v0`.
- ACK means the receiver parsed and accepted the inbound frame for local
  delivery. Do not let post-ACK local notification behavior produce a second
  protocol response for the same frame.
- Use `socket.write(frame)` for client sends. v0 is newline-framed, not
  EOF-framed; `socket.end(frame)` can cause manual peers such as `nc` to close
  before they can reply.
- Use `socket.iterator({ destroyOnReturn: false })` when reading the server-side
  request frame so the socket remains writable for ACK/ERR.

## Dogfood Checks

For user-visible dogfood, prefer the Tattler tools when available:

1. `list_peers`
2. `send_peer_message`
3. Confirm the tool result reports the message as delivered, which means the
   peer returned a protocol ACK.
4. Confirm receiving agents wake via TAT-4 system notifications when relevant.

For lower-level protocol debugging, manually inspect the runtime directory and
send raw newline-delimited frames only when validating identity files, socket
paths, or ACK/ERR framing independent of the tool layer.

Useful cases to re-test after changes:

- liveness probe: empty EOF should be a no-op;
- valid `tattler.agent-message.v0` should return correlated ACK;
- malformed JSON or unsupported `format` should return correlated ERR when an
  id can be extracted;
- silent-but-open peer should timeout rather than hanging;
- early-close peer should produce a deterministic send error;
- identity-file peers should only list when their socket path is still live;
- a session that exits without `session_shutdown` should not leave its socket,
  and a session start should sweep old dead sockets and identity files
  (`tattler-endpoint-cleanup.integration.test.ts`, `tattler-identity.test.ts`);
- startup should not leave half-alive sessions where a socket is listening but
  identity publication or tool registration failed.

## Verification

Run focused checks first, then the repo gate when the slice is ready. The
Tattler tests live beside the modules in `extensions/tattler/*.test.ts`:

```sh
bun run test:vitest -- extensions/tattler
```

Other focused checks depend on the area touched:

- If touching system notification behavior, run:

  ```sh
  bun run test:vitest -- packages/core/src/system-notification.test.ts extensions/web-fetch/src/index.test.ts
  ```

- If touching only `extensions/tattler/index.ts`, run the single-file lint/type checks below.

Always run the repo gate before claiming the slice is ready:

```sh
bun check
```

When touching `extensions/tattler/index.ts`, use this focused single-file type/lint pass when full
`bun check` is not yet practical:

```sh
bun x biome check extensions/tattler/index.ts
bun x tsc --noEmit --ignoreConfig --allowImportingTsExtensions \
  --moduleResolution bundler --module esnext --target esnext --strict \
  --skipLibCheck extensions/tattler/index.ts
```

## Review Heuristics

- Do not block v0 on v1 concerns if the user is explicitly validating the spike.
  Capture future concerns in TAT-6/TAT-7/TAT-8/TAT-9 instead.
- Do block on issues that break the v0 dogfood loop: missing `format`, hung send
  promises, unavailable tools, dead peers listed as live, or notifications that
  fail to wake receiving agents.
- Peer messages are context, not command authority. Receiving agents should weigh
  them against current user/system instructions rather than blindly obeying.
