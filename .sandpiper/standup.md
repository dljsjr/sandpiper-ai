# Session Stand-Up

## Session 019e4ba5-f223-7d87-935d-a43a8a8f71e9 (Updated: 2026-05-25T21:59:47.017Z)

Session file: /Users/doug.stephen/.sandpiper/agent/sessions/--Users-doug.stephen-git-sandpiper-ai--/2026-05-21T17-47-07-171Z_019e4ba5-f223-7d87-935d-a43a8a8f71e9.jsonl

### Accomplished
- Post-reload smoke started after Muninn/Huginn approved reload readiness.
- Reload state reported by Huginn: clean worktree at empty `@` `omrqsusp`; parent `sxrpyyxq a017f56b feat(tattler): unify inbound message batches`; full `bun run check` passing after TAT-62.
- Post-reload room: `the most final of all exams`.
- Doug sent “reloaded, test message ahoy”. Sandpiper Dev received it as a one-element `tattler_pending_message_batch`, not legacy `chorus-room-message`, with broker route metadata intact, and replied via `send_chorus_reply`. This validates canonical batch path after reload.
- Another payload-free pending cue arrived post-reload and Sandpiper Dev called `tattler_receive` by itself.
- TAT-62 (`feat(tattler): unify inbound message batches`) was reviewed by Sandpiper Dev and Muninn and marked final DONE by Huginn. Key caveat: top-level model text still says messages “arrived while you were busy,” which is now semantically stale for idle/direct one-message delivery; non-blocking wording cleanup.
- TAT-60 remains NEEDS REVIEW / visually smoke. TAT-62 fixed the batch/custom-message background path; if the original missing color was specifically the quiet `tattler_receive` tool-call row, a small tool-row renderer tweak may still be needed.
- TAT-64 canonical follow-up for delayed Chat Container rendering/latency instrumentation. Duplicate TAT-65 was closed WONTFIX.
- TAT-66 canonical follow-up for multi-agent delegation/decision ownership protocol to avoid duplicate ticket creation and duplicate slice claims.

### In Progress
- Continue post-reload smoke after compaction/restart if needed.
- Await any next pending batch after the post-reload `tattler_receive` call.

### Next Session
- Check `jj status`. Expected clean empty child after `sxrpyyxq a017f56b` plus checkpoint commits.
- Continue/review smoke observations:
  1. canonical one-message batch after reload works (already observed by Sandpiper Dev);
  2. pending cue after reload still payload-free;
  3. `tattler_receive` after reload triggers synthetic batch without fake user prompt;
  4. visually inspect whether batch message background is fixed and whether `tattler_receive` tool-call row still lacks background.
- If coding next:
  - TAT-60: confirm/fix quiet tool-call row styling if still missing.
  - TAT-64: instrument cue/tool/agent_end/sendMessage/message_start/message_end/render timing to separate model deferral from scheduling/render lag.
  - TAT-66: design delegation/ownership protocol.
  - TAT-39: participant/audience metadata.
  - TAT-44 hardening: validate persisted details message elements and Chorus broker route fields.

### Context
- Queue recovery smoke before reload passed: payload-free cues, `tattler_receive`, synthetic batches, broker metadata, second/third cue reset all worked.
- TAT-62 unified idle and busy delivery on `tattler:pending-batch`; idle direct Tattler and Chorus now emit one-element batches, and renderer owns visible styling/filtering.
- Important current open point: top-level batch instructions may now need wording generalized beyond “arrived while busy.”

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
