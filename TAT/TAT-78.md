---
title: "Track 3: Refactor Chorus as consumer of Tattler durable primitives"
status: NOT STARTED
kind: TASK
priority: LOW
assignee: UNASSIGNED
reporter: AGENT
created_at: 2026-05-27T15:51:59.546Z
blocked_by:
  - TAT-70
related:
  - TAT-69
updated_at: 2026-11-19T20:49:10.826Z
---

# Track 3: Refactor Chorus as consumer of Tattler durable primitives

Refactor Chorus to be a consumer of Tattler's durable substrate rather than owning its own messaging guts. Broker-less, session-decoupled. Chorus owns coordination semantics (fanout, audience) on top of the Tattler log + cursor, not the persistence layer itself. This is serial post-Track 1 (C1–C6). Supersedes TAT-69 (delegation protocol) — that work should target the new consumer architecture, not the current broker internals. TUI overhaul for Chorus-specific rendering lives here, separate from Track 2's standalone read-only TUI.

## Note: Chorus findings for the refactor (2026-11-17)

From the archived TOOLS-92 retained-surface inventory, which left them to the Tattler project. Checked against the code on 2026-11-17; the first has not been reproduced in a running session.

- A room's broker socket can appear as a peer in `list_peers`. `extensions/chorus.ts` creates the broker socket as `<shortId>-chorus-<room>-<uuid>.sock` in the Tattler runtime directory. `listPeerSockets()` in `extensions/tattler/tattler-identity.ts` lists every live socket there that has no `.id` file, excluding only the caller's own socket, so the broker shows up as `session:<shortId>-chorus-<room>-<uuid>`. A broker-less Chorus removes the socket; until then, discovery could skip `-chorus-` sockets.
- Chorus registers `send_chorus_reply` (now `deferred`) and the `/agent` and `/chorus` commands in every session, whether or not a room opens. The inventory also counted about 450 lines inside `extensions/tattler/` that exist only to bridge to Chorus. Decide both as part of making Chorus a consumer of the Tattler log.

## Parked in backlog triage (2026-11-19)

Tattler v1, with the durable message log folded into it, is the long-term goal and not current work (Doug). Parked at LOW. Design: `.sandpiper/docs/specs/durable-rooms-sizing.md` and `tat-72-audience-snapshot-design.md`, restored on 2026-11-19 from an abandoned change.

---

# Activity Log

## 2026-05-27T15:51:59.646Z

- **description**: added (1 line)
- **blocked_by**: (none) → TAT-70
- **related**: (none) → TAT-69

## 2026-11-17T22:46:28.670Z

- **description**: 1 line → updated (8 lines)

## 2026-11-17T22:46:37.218Z

- **description**: updated

## 2026-11-19T20:49:10.826Z

- **priority**: MEDIUM → LOW
- **description**: 8 lines → updated (12 lines)
