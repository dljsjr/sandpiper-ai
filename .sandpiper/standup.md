# Session Stand-Up

## Session 019e4ba5-f223-7d87-935d-a43a8a8f71e9 (Updated: 2026-05-25T21:40:50.356Z)

Session file: /Users/doug.stephen/.sandpiper/agent/sessions/--Users-doug.stephen-git-sandpiper-ai--/2026-05-21T17-47-07-171Z_019e4ba5-f223-7d87-935d-a43a8a8f71e9.jsonl

### Accomplished
- Reload/smoke of Tattler/Chorus queue recovery succeeded.
- Observed live in Chorus smoke room `final-final-exam-v2-draft-copy.docx`:
  - payload-free pending cue arrived while busy;
  - agents called `tattler_receive` alone;
  - synthetic `tattler_pending_message_batch` turns arrived, not fake Doug/user prompts;
  - Chorus broker route metadata survived in batched messages;
  - replies from batch context worked via `send_chorus_reply`;
  - second busy burst after drain produced a new cue, confirming cue dedupe reset works.
- Smoke verdict from Piper/Librarian, Huginn, Muninn, and Sandpiper Dev: queue recovery passes.
- UI defect found: `tattler_receive` tool call/background styling is missing because the call/result renderers are quiet/empty. Tracked as `TAT-60`; duplicate `TAT-61` closed WONTFIX.
- Doug made a follow-up architecture decision: idle single-message delivery and busy batch delivery should use the same custom message type/struct/renderer. The one-message idle case should be represented as a batch with one item.
- Created `TAT-62`: Unify idle and batched Tattler/Chorus custom message type.

### In Progress
- Queue recovery stack is smoke-passed and ready for integrated review/cleanup.
- `TAT-62` is the next architectural refactor to reduce custom-message divergence.

### Next Session
- Check `jj status`; latest checkpoint before this standup was `wzplkoxy 860068ef`, then working copy should be a clean empty child after this checkpoint.
- If continuing implementation, prioritize:
  1. `TAT-62`: converge idle `chorus-room-message` and busy `tattler:pending-batch` into one canonical Tattler/Chorus message-batch custom type. Use `content` as canonical model-facing concatenated XML/text; use `details: {kind:"batch", batchId, messages:[...]}` even for one message; renderer handles all visible rendering and filters hidden DMs.
  2. `TAT-60`: style `tattler_receive` call background while preserving quiet result semantics. This may simplify after TAT-62.
  3. `TAT-39`: broker-owned participant/audience metadata.
  4. TAT-44 validator hardening: validate persisted batch details elements and Chorus broker route string fields.
- For final queue-recovery wrap-up, mark `TAT-36` integrated review complete after any desired review pass.

### Non-blocking Follow-ups
- `TAT-39`: participant/audience metadata.
- `TAT-60`: missing `tattler_receive` call/background styling.
- `TAT-62`: canonicalize message custom type across idle/busy paths.
- TAT-44 validator hardening: malformed persisted runtime data checks.

### Context
- Final reviewed/smoke-passed queue-recovery stack includes through:
  - `ukqlnoyk a5dd149f fix(tattler): reset pending cue after drain`
  - prior queue commits listed in previous standup.
- Smoke room observations confirm core path works; hidden direct Tattler DM mixed with visible Chorus and reload/no-dup were not fully live-smoked by Sandpiper Dev, but covered/partially covered by tests and review notes.

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
