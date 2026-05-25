# Session Stand-Up

## Session 019e4ba5-f223-7d87-935d-a43a8a8f71e9 (Updated: 2026-05-25T19:08:19.216Z)

Session file: /Users/doug.stephen/.sandpiper/agent/sessions/--Users-doug.stephen-git-sandpiper-ai--/2026-05-21T17-47-07-171Z_019e4ba5-f223-7d87-935d-a43a8a8f71e9.jsonl

### Accomplished
- Chorus/Tattler hardening design has converged after final dogfood.
- Agreed problem split:
  1. interim Tattler/Chorus messages can be serialized or lost if routed through Pi steer/followUp while an agent is busy;
  2. main chat rendering is transcript/model-injection coupled, while Chorus widget can be live room surface;
  3. abort before queued custom messages drain can be data/context loss, not just UI.
- Agreed no-upstream architecture:
  - Tattler owns a durable pending inbox for inbound messages while busy.
  - `before_agent_start` is the universal durable drain point for any next agent turn.
  - `tattler_receive` is a cooperative model-initiated early-yield tool, not the only correctness path.
  - Chorus uses the Tattler inbox/batch machinery and remains the visible room consumer.
  - Batch custom message uses model-facing `content` plus structured renderer-only `details.messages[]` so a single durable custom_message can render as individual message blocks.
  - Avoid `context` hook as default because it is provider-payload-only and cache/replay hostile.
  - Keep semantic Chorus room reply affordance; do not collapse visible room replies into raw `send_peer_message`.
  - Add broker-owned participant/audience metadata to Chorus room messages.
- Created/updated tasks: `TAT-34` through `TAT-39`, with `TAT-36` pending inbox batching, `TAT-37` abort/context verification, `TAT-38` `tattler_receive`, and `TAT-39` participant metadata.
- Latest agreed lanes:
  - Piper/Librarian: IA/work plan + Trail breakdown/subtasks/assignments.
  - Huginn: source exploration/refactor points/Pi API boundaries.
  - Muninn + Sandpiper Dev: read-only architecture/code review as work lands.

### In Progress
- Await Piper IA/work plan and Huginn exploration output.
- Sandpiper Dev role here: review plans/diffs for architecture, public Pi API boundaries, queue/data-loss semantics, tool-surface restraint, and task coherence. Do not implement unless asked.

### Next Session
- Check `jj status`; current working copy has unrelated `extensions/system/startup-hooks.ts` WIP. Do not mix it into Chorus/Tattler commits.
- Review Piper’s IA/work plan and Huginn’s code/Pi exploration when they arrive.
- Review against key invariants: Tattler pending inbox source of truth; `before_agent_start` durable drain; `tattler_receive` cooperative interruption; widget/live display vs transcript/context split; broker-owned participant snapshots; no private Pi internals unless explicitly accepted; no tool sprawl.

### Blockers
- None for planning/review. Implementation still needs careful tests around before_agent_start persistence, abort recovery, duplicate delivery, renderer batches, and participant metadata.

### Context
- Latest checkpoint commits: `vqqmrqyr b79be6e6`, `vmwvtptr b6d5758f`, `vumrkktz 7830375a`.
- Current working copy before this checkpoint had only unrelated `extensions/system/startup-hooks.ts` WIP.

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
