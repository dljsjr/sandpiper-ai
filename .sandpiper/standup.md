# Session Stand-Up

## Session 019e4ba5-f223-7d87-935d-a43a8a8f71e9 (Updated: 2026-05-25T18:27:44.625Z)

Session file: /Users/doug.stephen/.sandpiper/agent/sessions/--Users-doug.stephen-git-sandpiper-ai--/2026-05-21T17-47-07-171Z_019e4ba5-f223-7d87-935d-a43a8a8f71e9.jsonl

### Accomplished
- Continued Chorus/Tattler dogfood investigation after final cosmetic slice.
- Refined the issues into three independent problems:
  1. **Message queuing/context completeness:** bursts of Chorus/Tattler messages can be serialized by Pi steering queue behavior, so an agent may see an incomplete interim picture.
  2. **Main chat render delay:** Chorus custom messages only render in the main Pi chat when injected into the session transcript; while streaming/hung, `sendMessage` queues.
  3. **Abort + queued messages:** queued custom messages can be lost if abort/clear happens before they drain/persist.
- Source corrections/findings:
  - `one-at-a-time` queue mode drains the oldest queued message, not the most recent. The issue is partial/serial context, not last-message-wins in core.
  - Queue mode is runtime-programmable at Agent/AgentSession/RPC/settings level (`all` vs `one-at-a-time`), but not exposed to ordinary ExtensionAPI.
  - Queue editing is not exposed to extensions. ExtensionContext only has `hasPendingMessages()`. AgentSession internally has `clearQueue()`, `pendingMessageCount`, `getSteeringMessages()`, `getFollowUpMessages()`.
  - `pi.sendMessage()` while streaming queues a role `custom` directly into core `agent.steer()`/`followUp()` and does not mirror it into AgentSession’s string queue arrays; abort/clear can therefore drop undrained custom messages before they emit/persist.
  - Once a custom message has emitted `message_start`/`message_end` and persisted as `custom_message` on the active branch, `buildSessionContext()` should include it in later context.
- API patterns identified:
  - Public no-upstream safe path: extension-owned pending inbox + live Chorus widget + idle batch flush via `pi.sendMessage(..., { triggerTurn:false })`.
  - Optional context-only path: `pi.on('context')` can inject a batch into the next provider payload, but must be paired with durability/dedupe to avoid ephemeral or duplicate delivery.
  - Proper upstream future: `sendDisplayMessage`/`appendDisplayMessage` for immediate display-only transcript entries, separate from model-visible custom messages.
- Created/updated tasks:
  - `TAT-34`: Decouple Chorus visual rendering from model-visible message injection.
  - `TAT-35`: Design Pi display-only message API for live extension transcript entries.
  - `TAT-36`: Batch Chorus and Tattler interim messages outside Pi steering queue.
  - `TAT-37`: Verify queued custom messages after abort are in active context.

### In Progress
- TAT-34/TAT-35/TAT-36/TAT-37 are active design/debug tasks.
- No code implementation yet for the inbox/batch mitigation.

### Next Session
- Start by checking `jj status` and this standup.
- Likely no-upstream implementation direction:
  1. On inbound room post/delivery, store/dedupe in an extension-owned pending inbox keyed by roomId/postId; optionally persist snapshots with `pi.appendEntry('chorus-pending-inbox', snapshot)`.
  2. Keep active Chorus widget as the live display surface by recording into broker entries and requesting render immediately.
  3. Do **not** call `pi.sendMessage` for individual inbound posts while busy/streaming.
  4. Register lifecycle handlers (`agent_end`, maybe `turn_end`/`message_end`) and only flush when `ctx.isIdle()` is true.
  5. Flush one batch custom message using `pi.sendMessage({ customType:'chorus-room-message', content: batchXml, display:false, details:{ kind:'batch', posts } }, { triggerTurn:false })`; idle path appends to agent state/session and persists/emits immediately without entering steer/followUp.
  6. Avoid `triggerTurn:true` by default to prevent unsolicited reply storms; use only if explicit audience/attention semantics require it.
  7. Consider `pi.on('context')` injection only as a context-completeness supplement, with careful dedupe/durability.
- For TAT-37, reproduce: start/force a mid-turn, queue 2-3 Chorus custom messages, abort, then inspect JSONL, active branch, and `buildSessionContext()` membership. Classify as UI-only or data/context loss.

### Blockers
- Main-chat immediate rendering without upstream support remains blocked by current API shape. Widget-as-live-plane is the safe no-upstream compromise.

### Context
- Current jj parent before this checkpoint: `kzkknknl cefdf7be chore: checkpoint chorus display-message investigation` on top of `wpmzmzty 121f5b0d fix(chorus): render self room messages distinctly`.
- Keep Chorus participation rule: don’t reply to every room message; use `done` for no-op/courtesy cases.

## Session 019e51bf-9ff6-7044-897e-24ff87b27adb (Updated: 2026-05-25T15:07:57.319Z)

Session file: /Users/doug.stephen/.sandpiper/agent/identities/Huginn/sessions/2026-05-22T22-12-53-366Z_019e51bf-9ff6-7044-897e-24ff87b27adb.jsonl

### Accomplished
- Collated Pi source/docs findings for Chorus live-render problem: `appendEntry` is persistence-only; `sendMessage` is renderable but queues while streaming and participates in model context.
- Confirmed Piper’s hung-period messages persisted in its JSONL as `custom_message` entries; likely visual/live-render delay, not transport loss.
- Proposed no-upstream workaround with group: use Chorus room widget as authoritative live display plane for active rooms; queue hidden model-visible custom messages separately; keep display:true fallback for inactive/no-widget sessions.
- Evaluated alternatives: direct main-chat container injection is private-boundary hack; `renderResult` only helps local tool rows; queue mode `all` exists but is not exposed to ExtensionAPI and does not solve hung-provider live render.
- Checkpoint updated at >80% context.

### In Progress
- Open design decision for Doug/Piper: choose no-upstream widget-live-plane workaround vs private direct-chat bridge vs upstream `sendDisplayMessage`/`appendDisplayMessage` API.
- Huginn remains Scout/collator/read-only reviewer.

### Next Session
- If implementing no-upstream: review that active room widget records/dedupes by `postId` and requests render immediately on inbound post/delivery; active-room model injection should be hidden (`display:false`) to avoid delayed duplicate visual entries.
- Preserve inactive/no-widget fallback (`display:true`) because no better current API exists.
- Do not repurpose `appendEntry` or rely on `renderResult` for inbound room messages.
- If considering queue mode: note modes are `one-at-a-time` and `all`; ExtensionAPI lacks setters; switching only affects drain after a turn boundary.
- Return to VCG CORE-1606 source-accuracy review when Chorus is parked.

### Blockers / Findings
- No current code blocker after amended `wpmzmzty` / `121f5b0d`.
- Design issue: current APIs couple main chat rendering to model/custom-message delivery; hung streams delay visible Chorus traffic unless widget/live-plane workaround or upstream API is added.

### Context
- Latest Scout-clear slices: `mnpqnnsn`, `lzkywlvt` + `utxmwlyn`, `pwpzxpkv`, amended `wpmzmzty` / `121f5b0d`.
- Latest room: `final-exams-pt2`.
