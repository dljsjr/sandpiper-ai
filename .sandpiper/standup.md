# Session Stand-Up

## Session 019e4ba5-f223-7d87-935d-a43a8a8f71e9 (Updated: 2026-05-25T21:35:46.304Z)

Session file: /Users/doug.stephen/.sandpiper/agent/sessions/--Users-doug.stephen-git-sandpiper-ai--/2026-05-21T17-47-07-171Z_019e4ba5-f223-7d87-935d-a43a8a8f71e9.jsonl

### Accomplished
- Completed and reviewed the Tattler/Chorus queue-recovery stack through smoke readiness.
- Review-clean commits in stack:
  - `xszoyull 7401716b` — `feat(tattler): buffer busy inbound messages` (TAT-36/40/41/42)
  - `wxqnulxl 5874382f` — `fix(tattler): harden pending inbox visibility`
  - `kzovvtpv 67fd7bc4` — `feat(tattler): render visible pending batches` (TAT-43)
  - `qmkvwvyz 4dc2e03c` — `fix(tattler): harden pending batch renderer`
  - `qlmwqxwt 0e561dc5` — `feat(tattler): persist pending inbox snapshots` (TAT-44)
  - `nnuynvtq cfab0afb` — `feat(tattler): add cooperative receive tool` (TAT-46/47)
  - `plnvlpqy f6b5724e` — `test(tattler): cover receive fallback paths` (TAT-48)
  - `oxnkmvrx 1f6c5381` — `feat(tattler): cue pending receive batches` (TAT-59)
  - `ukqlnoyk a5dd149f` — `fix(tattler): reset pending cue after drain`
- Core design now implemented:
  - Busy inbound Tattler/Chorus payloads go to a Tattler pending inbox instead of Pi steer/followUp.
  - Pending batch custom message uses canonical model-facing `content` and renderer-only structured `details.messages[]`.
  - Normal prompt/abort-resume path drains via `before_agent_start`.
  - Cooperative path uses `tattler_receive`: sequential/call-alone guided, hidden renderers, provider-safe content, `terminate:true`; it records a receive request and does not send during tool execution.
  - `agent_end` idle-defers, drains via shared helper, and triggers a direct custom-message batch turn with `pi.sendMessage(batch,{triggerTurn:true, deliverAs:'steer'})`; no fake `sendUserMessage`.
  - Batch renderer renders visible Chorus messages only and filters hidden Tattler DMs; malformed details render empty to avoid default raw-content fallback.
  - appendEntry snapshot restore exists and skips already delivered persisted batch messages.
  - First busy enqueue emits a best-effort hidden, payload-free cue telling the model pending messages exist and `tattler_receive` is available; cue dedupes while pending and resets after pending inbox drains.
- Verification reported across final stack:
  - focused Tattler/Chorus Vitest: 34/34 passed
  - full `bun check` passed
  - lizard on touched cue/reset/receive files: no threshold violations
- Trail state reported by Piper:
  - `TAT-40`, `TAT-41`, `TAT-42`, `TAT-43`, `TAT-44`, `TAT-46`, `TAT-47`, `TAT-48`, `TAT-59`, `TAT-38` complete/final.
  - `TAT-36` moved to NEEDS REVIEW for integrated queue-recovery stack.

### In Progress
- Reload/smoke testing of queue recovery is the active next step.
- A new Chorus room `final-final-exam-v2-draft-copy.docx` has started; Doug sent “Here's the first message.” This appears to be smoke/dogfood setup; no substantive reply was needed.

### Next Session / Smoke Checklist
- Start with `jj status`; working copy was clean at latest `@` child after `ukqlnoyk a5dd149f` when reviewed.
- Queue-recovery smoke checklist:
  1. while an agent is busy, send direct Tattler DM and/or Chorus room post;
  2. verify pending cue is hidden/non-rendered, payload-free, and contains only count + instructions to call `tattler_receive` if relevant;
  3. agent calls `tattler_receive` alone;
  4. synthetic custom-message batch turn starts; no fake Doug/user prompt appears;
  5. visible Chorus messages render as blocks; hidden Tattler DMs do not render but remain model-visible in batch content;
  6. after batch persistence, next context/restore does not duplicate delivered messages from appendEntry snapshot;
  7. second busy burst after drain cues again.

### Non-blocking Follow-ups
- `TAT-39`: broker-owned Chorus participant/audience metadata.
- TAT-44 validator hardening: validate persisted batch `details.messages.every(isPendingMessage)` and full Chorus broker route string fields to avoid malformed runtime-data restore issues.
- Optional broader abort/compaction proof tasks under TAT-37 remain evidence/cleanup, not reload-critical.

### Context / Review Notes
- Previous review blockers fixed:
  - mixed visible/hidden batch raw-content UI leak fixed by renderer/filtering and malformed-details guard;
  - pending cue dedupe reset fixed via `createTattlerPendingInboxNotifier()` + `onPendingInboxEmpty` hook;
  - no `sendUserMessage` synthetic receive path.
- Reviewers (Muninn + Sandpiper Dev) approved final queue-recovery smoke readiness.

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
