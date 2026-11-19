# TAT-72 Design: Audience Snapshot at Append

> Restored 2026-11-19 from change `xqlzzyls` (commit `c8638029`), which was abandoned on 2026-09-08 before it reached the main line. Written against the May 2026 code; check paths and APIs against the current tree before implementing. Part of Tattler v1, the long-term goal (Doug, 2026-11-19).

**Owner:** Piper (Librarian)
**Status:** Design in progress
**Depends:** TAT-71 (COMPLETE)

## Problem

When a message is appended to the durable room log, future readers need to know who could see that message at the time it was sent. This is the "audience snapshot" — a point-in-time capture of room participants at append time.

Without it, replay and read-from-cursor have no way to render "who was in the room when this was said," which matters for:

- TUI rendering (participant list on historical messages)
- Agent reply policy (who can see my reply?)
- Audit/replay fidelity

## TAT-39/50 Integration

TAT-39 (participant metadata on Chorus room messages) and TAT-50 (broker-owned participant snapshot) are the existing work that stamps audience data onto room posts at fanout time. C2 consumes this by persisting the audience snapshot into the durable record at append time.

**Contract:**

- TAT-50 ensures the Chorus broker populates a participant list on `ChorusRoomPostV0` before fanout
- C2 reads that participant list from the post and writes it into the `audience_snapshot` column
- The durable record stores audience as a JSON array — denormalized by design (snapshot, not a join target)

## Current Message Shapes (from tattler-protocol.ts)

**ChorusRoomPostV0:** `{ id, roomId, from, broker, message }`

- `broker` is `ChorusReplyRouteV0 { name, socketPath, shortId }` — session-bound, not durable
- `from` — display handle at post time

**ChorusRoomDeliveryV0:** `{ id, roomId, from, message, postId }`

**TattlerAgentMessageV0:** `{ id, from, message }`

## Durable Record Schema (TAT-71)

`messages` table columns relevant to C2:

- `id` TEXT — UUIDv7 post id
- `room_id` TEXT — stable room identifier
- `agent_id` TEXT — durable author key (Tattler ID for persistent, guest UUID for ephemeral)
- `handle` TEXT — display handle snapshot at post time
- `body` TEXT — message body
- `audience_snapshot` TEXT — JSON array (this is what C2 fills)

## Audience Snapshot Envelope

```json
[
  { "agentId": "Huginn", "handle": "Huginn" },
  { "agentId": "019e6a...uuid", "handle": "Scout" },
  { "agentId": "Doug", "handle": "doug" }
]
```

- `agentId` — the stable key (Tattler ID for persistent agents, guest UUID for ephemeral)
- `handle` — display name snapshot at append time (not a FK, not stable across renames)

This is a **denormalized point-in-time snapshot**. It is not a relationship. It is not a join target. It is not live membership state.

## What Gets Snapshotted

**At append time, the audience snapshot includes:**

1. The sender (they're in the room)
2. All known room participants at fanout time (from TAT-50 broker stamp)
3. Doug (if present) — human participants are part of the audience

**What does NOT go in the snapshot:**

- `broker.socketPath` / `broker.shortId` — session-bound, not durable
- Presence/online status — ephemeral
- Read receipts / cursor positions — that's cursor state, not audience

## Append Path Integration

The `appendMessage()` function in `tattler-room-log.ts` already accepts an `audienceSnapshot` parameter. The C2 work is:

1. At `ChorusRoomPostV0` receipt, extract the participant list (from TAT-50 stamp, or from the broker's known participants if TAT-50 hasn't landed yet)
2. Transform to `[{ agentId, handle }]` format
3. Pass to `appendMessage()` as the `audience_snapshot` value
4. `appendMessage()` serializes to JSON and writes to the `audience_snapshot` column

## Fallback: TAT-50 Not Yet Landed

If TAT-50 hasn't shipped when C2 needs to work, the fallback is:

- Chorus broker provides a `participants()` method that returns current room membership
- C2 calls this at append time instead of reading a stamped field
- The snapshot is still correct — it's just computed at append time rather than stamped at fanout time
- Once TAT-50 lands, the stamped field becomes the authoritative source

## Open Questions

None currently. The design is straightforward — the hard part was deciding that the snapshot is denormalized JSON, not a normalized table. That decision is locked.

## Out of Scope

- Live audience rendering (that's the TUI's job)
- Audience change events (join/leave notifications)
- Cross-room audience aggregation
