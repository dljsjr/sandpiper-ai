# Session Stand-Up

## Session 019e4ba5-f223-7d87-935d-a43a8a8f71e9 (Updated: 2026-05-25T19:00:59.388Z)

Session file: /Users/doug.stephen/.sandpiper/agent/sessions/--Users-doug.stephen-git-sandpiper-ai--/2026-05-21T17-47-07-171Z_019e4ba5-f223-7d87-935d-a43a8a8f71e9.jsonl

### Accomplished
- Refined Tattler/Chorus queue-loss design after Doug reframed the three problems.
- Key correction: `before_agent_start` (current public hook; Doug called it begin_agent_turn) is the right durable injection point, not the `context` hook. `before_agent_start` can return a custom message that AgentSession includes in the prompt batch; those messages emit/persist as `custom_message`, unlike `context` payload transforms which are non-destructive/provider-only and can bust cache.
- Finalized stronger invariant:
  - inbound while busy → Tattler-owned pending inbox, not Pi steer/followUp queue;
  - every next agent start for any reason checks pending inbox;
  - `before_agent_start` injects one canonical persistent batch custom message and only then clears/marks pending delivered.
- This gives three recovery paths:
  1. model calls `tattler_receive` → terminate → synthetic receive turn → `before_agent_start` drains;
  2. user aborts hung provider and sends any next prompt → `before_agent_start` drains;
  3. agent naturally finishes and later starts any turn → same drain path.
- Designed `tattler_receive` cooperative interruption tool:
  - Tattler-level, not Chorus-level.
  - Busy first-arrival sends at most one nudge: pending messages exist; call `tattler_receive` if they may affect current work.
  - Tool should be sequential/called alone, quiet result, provider-safe content, `terminate:true`, call renderer indicating it is ending/checking messages, and set a receive-after-agent-end flag.
  - `agent_end` must defer/idle-poll before triggering synthetic turn to avoid reentrancy.
- Decided batch custom message shape:
  - `content`: model-visible concatenation/XML/markdown of all pending messages.
  - `details`: structured `{ kind:'batch', batchId, messages:[...] }` for renderer.
  - Custom renderer can ignore `content` for UI and render each `details.messages[]` item as its own existing room-message block, preserving presentation while batching into one durable entry.
- Created/updated tasks:
  - `TAT-36`: Batch Chorus and Tattler interim messages outside Pi steering queue.
  - `TAT-37`: Verify queued custom messages after abort are in active context.
  - `TAT-38`: Add Tattler receive cooperative interruption tool.

### In Progress
- TAT-36/TAT-37/TAT-38 design/debug. No implementation yet.
- Working copy has an unrelated `extensions/system/startup-hooks.ts` WIP that this session should not mix into Chorus/Tattler checkpoint commits.

### Next Session
- Check `jj status`. Preserve unrelated `extensions/system/startup-hooks.ts` unless explicitly asked.
- If implementing TAT-36/TAT-38:
  1. Add Tattler pending inbox state keyed by message ID / roomId+postId.
  2. On inbound Tattler/Chorus while busy, record pending + render live widget if applicable; do not call `pi.sendMessage` for actual message while busy.
  3. Persist inbox mutations with `pi.appendEntry` if crash/reload durability is desired.
  4. Register `before_agent_start`; if pending inbox non-empty, return one batch custom message and mark entries delivered only after successful return/persistence semantics are understood.
  5. Add batch details renderer so each pending Chorus message appears as separate block.
  6. Add `tattler_receive` tool with `terminate:true`, sequential/call-alone guidance, and idle-deferred synthetic turn trigger in `agent_end`.
  7. Avoid `context` hook except as last-resort emergency injection; it is provider-payload-only and cache-hostile.
- For TAT-37, reproduce abort behavior and classify current bug as UI-only vs data/context loss.

### Blockers
- None for no-upstream inbox/before_agent_start plan, but need careful tests around persistence, duplicate delivery, and event reentrancy.

### Context
- Current jj stack before this checkpoint: `vqqmrqyr b79be6e6 chore: checkpoint chorus queue investigation` on top of prior Chorus stack. Working copy currently has unrelated `extensions/system/startup-hooks.ts` changes.
- Keep using Chorus participation rule: reply only if addressed/own lane/new info/silence blocks; use `done` for no-op/courtesy cases.

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
