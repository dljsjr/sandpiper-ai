# Session Stand-Up

## Session 019e4ba5-f223-7d87-935d-a43a8a8f71e9 (Updated: 2026-05-25T19:05:32.233Z)

Session file: /Users/doug.stephen/.sandpiper/agent/sessions/--Users-doug.stephen-git-sandpiper-ai--/2026-05-21T17-47-07-171Z_019e4ba5-f223-7d87-935d-a43a8a8f71e9.jsonl

### Accomplished
- Continued Tattler/Chorus design after context checkpoint.
- Confirmed batch custom message shape: `content` carries canonical model-facing concatenated messages; `details` carries structured `{ kind:'batch', batchId, messages:[...] }` for custom renderers to render each item as a separate Chorus/Tattler block. Details are renderer-only and not sent to LLM; content must stand alone for model/cache/audit/compaction.
- Discussed tool-surface slimming: consensus is to reduce aggressively but not collapse Chorus into raw `send_peer_message`. Chorus room reply needs semantic room/broker/fanout/visible-message affordance. Possible future: one typed Tattler send tool with variants, but plain peer DM is too low-level/confusing.
- Added new follow-up `TAT-39`: Add Chorus participant audience metadata to room messages.

### In Progress
- TAT-36/TAT-37/TAT-38 remain design/debug tasks for pending inbox, abort recovery, and `tattler_receive`.
- TAT-39 added for broker-owned participant/audience metadata.

### Next Session
- Preserve unrelated `extensions/system/startup-hooks.ts` WIP unless explicitly asked.
- For TAT-39: add broker-injected participant/audience metadata to Chorus room messages. Recipients should know who is in the room and who will see replies. Do not require agents/tools to provide participants. Broker owns peer set + local author identity, so inject into delivery/custom-message details and model-facing content.
- Continue TAT-36/TAT-38 with before_agent_start as canonical pending inbox drain point and `tattler_receive` as cooperative early-yield path.
- Keep `context` hook as last-resort only; it is provider-payload-only and cache-hostile.

### Blockers
- None for design checkpoint. Need implementation/testing next.

### Context
- Latest checkpoint commits: `vqqmrqyr b79be6e6` (queue investigation) and `vmwvtptr b6d5758f` (tattler receive design). Current working copy still has unrelated `extensions/system/startup-hooks.ts` modification.

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
