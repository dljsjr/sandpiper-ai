# Session Stand-Up

## Session 019e4ba5-f223-7d87-935d-a43a8a8f71e9 (Updated: 2026-05-25T22:11:15.827Z)

Session file: /Users/doug.stephen/.sandpiper/agent/sessions/--Users-doug.stephen-git-sandpiper-ai--/2026-05-21T17-47-07-171Z_019e4ba5-f223-7d87-935d-a43a8a8f71e9.jsonl

### Accomplished
- Wrapped the Chorus/Tattler queue-recovery dogfood session and marked the primary integrated work complete.
- TAT-36 is COMPLETE / DONE after live smoke, reload smoke, and multi-agent review.
- Queue recovery core path passed live dogfood:
  - payload-free pending cues arrive while the agent is busy;
  - `tattler_receive` is called alone and terminates the current turn cleanly;
  - synthetic `tattler_pending_message_batch` arrives as custom/extension content, not a fake Doug/user prompt;
  - Chorus broker route metadata survives batching and reloads;
  - room replies via `send_chorus_reply` work from batch context;
  - additional busy bursts cue again after drain.
- TAT-62 is COMPLETE / DONE: idle/direct Tattler and Chorus deliveries now use the same canonical `tattler:pending-batch` custom message shape as busy drains. Single-message idle/direct delivery is a one-element batch with `details: { kind: 'batch', batchId, messages: [...] }`.
- TAT-60 is COMPLETE / DONE: visible Chorus cards in the canonical batch renderer now have background styling plus one full-width blank line above/below and one background-colored cell of horizontal padding on left/right. Doug visually confirmed everything looks great.
- Post-reload rooms validated the new path:
  - `the most final of all exams`: one-element batch after reload, route metadata intact, replies through broker.
  - `final fantasy lxvii`: post-TAT-60 reload and receive path alive; cue → `tattler_receive` → canonical batch → broker reply works.
- Multi-agent review/verification passed on the final stack:
  - focused Tattler/Chorus Vitest: 35/35 passed in Sandpiper Dev/Huginn lane;
  - renderer Vitest: 2/2 passed for card padding;
  - full `bun check` passed;
  - lizard/hygiene on touched renderer/files showed no threshold issues.
- TAT-64 remains the canonical follow-up for delayed Chat Container rendering/latency instrumentation.
- TAT-66 remains the canonical follow-up for multi-agent delegation/decision ownership to prevent duplicate ticket creation and duplicate slice claims.

### In Progress
- None for this session. Doug called the Chorus/Tattler queue-recovery slice buttoned up.

### Next Session
- Start by checking `jj status`. Expected clean empty child above final wrap-up checkpoint.
- If continuing Chorus/Tattler follow-ups, good next tasks are:
  - TAT-64: instrument cue emission, model-visible cue timing, `tattler_receive` tool start/end, `agent_end`, synthetic `sendMessage(batch)`, `message_start/end`, and render timing to distinguish model deferral from scheduling/render lag.
  - TAT-66: design lightweight room delegation/ownership protocol: explicitly named owner before shared-state actions, defer/review lanes, possible broker-mediated assignment/claim markers.
  - TAT-39: broker-owned Chorus participant/audience metadata.
  - TAT-44 validator hardening: validate persisted `details.messages.every(isPendingMessage)` and Chorus broker route string fields.
  - Optional polish: generalize top-level batch instructions away from “arrived while you were busy” now that idle/direct one-message deliveries use the same batch envelope.
- Do not reopen TAT-36/TAT-60/TAT-62 unless a regression is found; they are complete.

### Context
- Canonical invariant after this session: Tattler/Chorus inbound delivery uses `tattler:pending-batch` everywhere. Busy drains and idle/direct delivery differ only by entrypoint and message count.
- Visible Chorus rendering is owned by `extensions/tattler/tattler-inbox-renderer.ts`; hidden direct Tattler DMs remain model-visible content but are not UI-rendered.
- Quiet completion/no-response is the generic system `done` tool, not Chorus-specific behavior.
- Substantive Chorus room replies must use `send_chorus_reply` with broker route metadata; do not use plain Tattler DM for room replies.
- Current final local stack top before wrap commit included:
  - `rylstlsy` / `69f2d3fc` — `fix(tattler): add horizontal card padding`
  - `tzuoyxvk` / `8b1fca01` — `fix(tattler): pad pending batch cards`
  - `sxrpyyxq` / `a017f56b` — `feat(tattler): unify inbound message batches`
  - earlier queue-recovery stack ending in cue reset and receive fallback coverage.

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
