---
title: "Map queue recovery implementation seams"
status: COMPLETE
resolution: DONE
kind: SUBTASK
priority: MEDIUM
assignee: "Huginn"
reporter: USER
created_at: 2026-05-25T19:11:37.996Z
updated_at: 2026-07-11T16:53:29.582Z
---

# Map queue recovery implementation seams

Source-grounded implementation seam map for the Tattler/Chorus queue recovery work.

Pi usage seams:
- Use `before_agent_start` for normal user-prompt / abort-resume recovery only. Source: `AgentSession.prompt()` builds the prompt batch, then calls `emitBeforeAgentStart()`, then appends returned role `custom` messages into the batch. These custom messages are persistent because the agent loop emits `message_start/end` and `_handleAgentEvent()` persists role `custom` as `custom_message`.
- Do not use `context` for canonical delivery. It is payload-transform only and would create cache/replay mismatch.
- Do not use `sendUserMessage` for synthetic receive. It renders like the user spoke.
- For synthetic receive after `tattler_receive`, use `pi.sendMessage(batchCustomMessage, { triggerTurn: true })` after idle. Source: `sendCustomMessage(triggerTurn:true)` calls `_runAgentPrompt(appMessage)` directly; it bypasses `before_agent_start` but still emits/persists the custom message and sends `content` to the LLM via normal custom-message conversion.
- Shared invariant is not "before_agent_start is universal"; it is "all entrypoints use the same drain helper/schema." Callers: `before_agent_start` for normal prompts, deferred `agent_end` synthetic receive for cooperative receive.
- If scheduling from `agent_end`, defer one tick / idle-poll before calling `sendMessage(triggerTurn:true)` to avoid reentrancy while event dispatch unwinds.
- `terminate:true` only stops follow-up when every finalized tool result in the batch is terminating. Give `tattler_receive` `executionMode: 'sequential'` and guidance to call it alone.

Tattler seams:
- Current inbound agent messages enter at `dispatchIncomingPayloadFrame()` in `extensions/tattler/tattler-ipc.ts`, which calls `sendAgentMessageNotification()` and immediately `sendSystemNotification(... triggerTurn:true)`. This is the seam to route busy inbound payloads into a Tattler-owned pending inbox instead of Pi steer/followUp.
- `createServerWithNotificationSender(pi)` currently receives only the ExtensionAPI-like sender/event bus. To make busy decisions, pass a richer Tattler runtime from `session_start` that can call `ctx.isIdle()` (or expose an idle provider closure) plus `pi.sendMessage`/`pi.events`.
- Pending inbox should live in Tattler runtime code, keyed by source format + message id / room id / post id. It should dedupe and preserve arrival order.
- Use `pi.appendEntry(...)` only for durable pending-inbox audit/snapshot/mutation records; it is not model-visible and not renderable. Restore pending inbox on `session_start` by scanning `ctx.sessionManager.getEntries()` for those custom entries.
- First busy message can enqueue a small nudge notification telling the agent pending Tattler messages exist and it may call `tattler_receive`; correctness must not depend on that nudge surviving abort.

Chorus seams:
- Current room receive paths in `extensions/chorus.ts` (`handleRoomPostReceived`, `handleRoomDelivery`, and `onLocalParticipantMessage`) call `sendChorusMessageToChat()` immediately. These should submit to the Tattler pending-inbox/batch machinery when busy, while the active room widget continues rendering live from broker state.
- `sendChorusMessageToChat()` / `createChorusUserMessageContent()` in `chorus-ui.ts`/`chorus-runtime.ts` are the existing custom-message content/renderer path. Extend them or add Tattler batch renderer support so batch details render as individual message blocks.
- Keep `send_chorus_reply` as the semantic visible-room reply affordance; do not replace it with raw `send_peer_message`.

Batch data/rendering seams:
- Canonical batch custom message: `content` is complete model-facing XML/text containing all pending messages in order; `details` carries structured `{ kind:'batch', batchId, messages:[...] }` for rendering/dedupe.
- Renderer should branch legacy single vs batch details. Batch rendering iterates `details.messages` and delegates to the existing single-message components so UI still looks like separate messages.
- Clear/mark pending delivered only after the batch message has been returned from `before_agent_start` or handed to `sendMessage(triggerTurn:true)` successfully.

Chorus participant metadata seams:
- Protocol types in `tattler-protocol.ts` currently carry roomId/from/broker/message/postId but no audience. Broker owns peer set/local author in `ChorusRoomBroker`; add best-effort participant snapshot there before fanout/model injection.
- Add participant snapshot to model-facing Chorus content and structured details. Do not require send/reply tools or agents to supply participants.

Validation seams:
- Add tests around Tattler inbox buffering, `before_agent_start` normal-prompt drain, synthetic direct batch `sendMessage(triggerTurn:true)`, abort+resume recovery, batch renderer output, and broker-owned participants.
- TAT-37 should still classify current behavior: persisted custom_message on active branch = UI replay/reconciliation; undrained steer/followUp custom payload lost on abort = data/context loss.

---

# Activity Log

## 2026-05-25T19:12:35.008Z

- **title**: Review queue recovery plan and implementation seams → Map queue recovery implementation seams
- **description**: updated

## 2026-05-25T19:12:35.070Z

- **status**: NOT STARTED → IN PROGRESS
- **assignee**: UNASSIGNED → Huginn

## 2026-05-25T19:12:57.178Z

- **assignee**: Huginn → Muninn + Sandpiper Dev

## 2026-05-25T19:20:13.866Z

- **assignee**: Muninn + Sandpiper Dev → Huginn
- **description**: 1 line → updated (35 lines)

## 2026-05-25T19:20:13.981Z

- **status**: IN PROGRESS → NEEDS REVIEW

## 2026-07-11T16:53:29.582Z

- **status**: NEEDS REVIEW → COMPLETE
- **resolution**: DONE
