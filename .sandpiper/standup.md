# Session Stand-Up

## Session 019e4ba5-f223-7d87-935d-a43a8a8f71e9 (Updated: 2026-05-25T19:16:02.145Z)

Session file: /Users/doug.stephen/.sandpiper/agent/sessions/--Users-doug.stephen-git-sandpiper-ai--/2026-05-21T17-47-07-171Z_019e4ba5-f223-7d87-935d-a43a8a8f71e9.jsonl

### Accomplished
- Corrected the synthetic receive design after Huginn source read and Doug UX concern.
- Important Pi nuance: `before_agent_start` only runs through normal prompt / `sendUserMessage()` paths. `pi.sendMessage(customMessage, { triggerTurn:true })` calls `_runAgentPrompt(appMessage)` directly and bypasses `before_agent_start`.
- `sendUserMessage` is rejected for synthetic receive because it renders as Doug/user, which is misleading.
- Revised invariant: the shared drain helper/schema is universal, not `before_agent_start` itself.
  - User-resume path: `before_agent_start` calls `drainPendingInboxToBatch()` and returns the canonical batch custom message alongside the user prompt.
  - Cooperative receive path: `tattler_receive` sets receive flag + `terminate:true`; `agent_end` waits until idle; then calls the same helper and `pi.sendMessage(batchCustomMessage, { triggerTurn:true })`.
  - Both paths persist normal `custom_message` entries and share content/details/batchId/dedupe semantics.
- This preserves extension-authored durable context without fake user-authored rendering.

### In Progress
- Await Piper IA/work plan and Huginn seam map finalization before coding.
- Sandpiper Dev review lane remains active/read-only.

### Next Session
- Check `jj status`; unrelated `extensions/system/startup-hooks.ts` WIP should still be preserved and not mixed.
- Review plans/diffs against updated invariant: shared drain helper/schema; `before_agent_start` for real user prompt recovery; `sendMessage(triggerTurn:true)` for synthetic custom-message receive turn; no `sendUserMessage` synthetic receive.
- Ensure tests cover both paths and prove they create equivalent canonical batch custom messages.

### Blockers
- None; this is a design correction to avoid misleading user-message semantics.

### Context
- Latest checkpoint before this one: `qvonuqsw 5ba123db chore: checkpoint tattler implementation lanes` and `vumrkktz 7830375a` participant metadata checkpoint.

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
