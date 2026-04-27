---
title: "Draft Tattler/Chorus queue recovery implementation work plan"
status: COMPLETE
resolution: DONE
kind: TASK
priority: HIGH
assignee: "Piper"
reporter: USER
created_at: 2026-05-25T19:12:35.237Z

depends_on:
  - TAT-45
related:
  - TAT-36
  - TAT-37
  - TAT-38
  - TAT-39
updated_at: 2026-05-25T19:25:00.660Z
---

# Draft Tattler/Chorus queue recovery implementation work plan

IA/work plan for the Tattler/Chorus queue-recovery slice. This is the review gate before implementation.

## Problem split

1. Busy-time inbound messages should not depend on Pi's steer/followUp queues. In one-at-a-time mode, bursts are serialized into partial context; abort/clear can drop queued custom messages before they persist.
2. Main-chat rendering is transcript/model-injection coupled. Chorus widget can remain the live room surface; transcript rendering follows durable custom-message delivery.
3. Abort recovery must be data-safe: user abort + any next prompt should drain missed Tattler/Chorus messages into the next turn.

## Chosen design

- Tattler owns a pending inbox for inbound messages received while busy.
- Real inbound payloads are not sent through Pi queues while busy.
- A shared `drainPendingInboxToBatch()` helper creates the canonical batch custom message and owns pending-clear semantics.
- Normal user prompts and `pi.sendUserMessage` turns run `before_agent_start`; that hook drains via the shared helper for user abort + resume and other normal next-turn paths.
- Pi nuance from source: `pi.sendMessage(..., { triggerTurn:true })` / `sendCustomMessage` calls `_runAgentPrompt(appMessage)` directly and bypasses `before_agent_start`. Synthetic receive should therefore trigger a turn with the batch custom message itself, using the same drain helper, rather than sending a fake user prompt solely to reach `before_agent_start`.
- `before_agent_start` custom messages are appended to the prompt batch after the user prompt, not literally prepended. They are still persistent/model-visible custom messages.
- `tattler_receive` is an optional cooperative interruption tool that lets the model intentionally end the current turn and create the next drain boundary. It is not the only correctness path.
- Chorus uses the Tattler inbox/batch machinery for visible room traffic while preserving its room/broker semantics.
- The batch custom message duplicates data intentionally: `content` is complete model-visible text/XML; `details` is structured renderer data with `kind=batch`, `batchId`, and `messages[]`.
- Chorus broker stamps a participant/audience snapshot into canonical room posts so receiving agents know who will see replies.

## Immediate implementation tickets

- TAT-36: Core pending inbox, shared drain helper, batch schema/rendering, and busy/abort/resume delivery tests.
- TAT-37: Source/test classification for abort data loss vs UI replay and the fixed abort+resume path.
- TAT-38: Cooperative `tattler_receive` tool and deferred synthetic receive turn.
- TAT-39: Broker-owned Chorus participant/audience metadata.

## Non-goals for this slice

- No default `context` hook injection; it is provider-payload-only and breaks transcript/cache/replay alignment.
- No private chat-container injection as default live rendering path.
- No raw `send_peer_message` replacement for visible Chorus room replies; keep a semantic room-post/reply affordance.
- No stable roster/read-receipt protocol; participant metadata is a best-effort broker snapshot at fanout time.
- No broad tool-surface expansion beyond the justified Tattler receive affordance.

## Review gate

Before coding, Huginn should provide the source-grounded seam map. Piper keeps the task breakdown aligned. Muninn + Sandpiper Dev review the plan/seams for public Pi API usage, queue/data-loss semantics, and architectural scope.

---

# Activity Log

## 2026-05-25T19:12:35.376Z

- **status**: NOT STARTED → IN PROGRESS
- **assignee**: UNASSIGNED → Piper

## 2026-05-25T19:14:18.277Z

- **description**: 1 line → updated (38 lines)
- **related**: (none) → TAT-36, TAT-37, TAT-38, TAT-39, TAT-34, TAT-35

## 2026-05-25T19:14:54.483Z

- **description**: 38 lines → updated (39 lines)

## 2026-05-25T19:17:27.916Z

- **depends_on**: (none) → TAT-45
- **related**: TAT-36, TAT-37, TAT-38, TAT-39, TAT-34, TAT-35 → TAT-36, TAT-37, TAT-38, TAT-39

## 2026-05-25T19:19:20.165Z

- **status**: IN PROGRESS → NEEDS REVIEW

## 2026-05-25T19:25:00.664Z

- **status**: NEEDS REVIEW → COMPLETE
- **resolution**: DONE
