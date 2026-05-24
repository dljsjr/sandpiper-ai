# Session Stand-Up

## Session 019e4ba5-f223-7d87-935d-a43a8a8f71e9 (Updated: 2026-05-25T14:56:37.086Z)

Session file: /Users/doug.stephen/.sandpiper/agent/sessions/--Users-doug.stephen-git-sandpiper-ai--/2026-05-21T17-47-07-171Z_019e4ba5-f223-7d87-935d-a43a8a8f71e9.jsonl

### Accomplished
- Final Chorus cosmetic slice landed and was reviewed clean:
  - `wpmzmzty` / `121f5b0d` — `fix(chorus): render self room messages distinctly`.
  - Scope: self/local-agent Chorus messages render in Pi chat with distinct success tag/background; widget transcript wrapped rows are flush-left; agent-authored local broker self echoes are deferred until `ctx.isIdle()` to avoid tool-time steer.
  - This session re-reviewed amended commit read-only: focused Vitest 22/22, full `bun check`, lizard clean, scans clean; no blockers.
- Reload smoke in Chorus room `final-exams-pt2` exercised new rendering. Normal participant check-ins worked; Piper/Librarian recovered from a gummed upstream websocket and checked in.
- Doug surfaced a new lifecycle/render bug: while Piper was hung mid-turn, incoming Chorus messages did not render in the main Pi chat until/unless the turn boundary delivered custom messages.
- Split investigation results across agents:
  - Piper/Librarian inspected `$SANDPIPER_SESSION_FILE`: hung-period Chorus posts were persisted as `custom_message` entries with `customType:"chorus-room-message"`, `display:true`, full XML content, and details. Evidence points to visual/live-render delay, not transport loss.
  - Source/docs read here and by Huginn/Muninn: `pi.appendEntry()` is extension-private persistence only (`appendCustomEntry`), no LLM context, no `message_start`/`message_end`, no custom renderer path.
  - `pi.sendMessage()` / `sendCustomMessage()` is the only documented custom-message render path; when idle with `triggerTurn:false` it appends to agent state/session and emits render events immediately, but while streaming it queues via `agent.steer()`/`followUp()` and waits for agent-loop delivery.
  - `registerMessageRenderer()` is documented for messages sent via `pi.sendMessage()`, not arbitrary custom entries.
  - `ctx.ui.setWidget`, `notify`, and `setStatus` are immediate UI surfaces but not main-chat transcript entries.
- Created follow-up tasks:
  - `TAT-34` BUG: Decouple Chorus visual rendering from model-visible message injection.
  - `TAT-35` TASK: Design Pi display-only message API for live extension transcript entries.

### In Progress
- `TAT-34`/`TAT-35` investigation/design. Current conclusion: existing Pi extension APIs do not provide “render chat transcript entry immediately, but inject model-visible context separately later.”
- No code changes for TAT-34/35 yet in this session; only task/standup updates.

### Next Session
- Start by checking `jj status` and reading this standup.
- For TAT-34/TAT-35, likely design direction:
  - Add a host/API path such as `sendDisplayMessage` / `appendDisplayMessage` for immediate rendered transcript entries that do not enter LLM context.
  - Keep model-visible Chorus context as a separate hidden `custom_message`/message injection path that can queue normally for turn boundaries.
  - Avoid repurposing `appendEntry` as-is; its current contract is extension state persistence and rendering it would blur state records vs visible transcript events.
  - Consider stable caller-provided keys/details for dedupe, e.g. `chorus:<postId>` or `details.postId`.
  - Failure semantics: visual delivery should be best-effort and persist if rendered; model delivery may be delayed/fail independently but should eventually enter next model context unless deduped/suppressed.
- If reviewing implementation, ensure immediate display path emits the same UI event/render path as custom messages without mutating `agent.state.messages` or `buildSessionContext()`.
- Existing task statuses after earlier slices: TAT-29/TAT-30/TAT-31/TAT-32/TAT-33 and TAT-23 are NEEDS REVIEW; TAT-34/TAT-35 are IN PROGRESS.

### Blockers
- Need Pi host/API support or sanctioned direct chat-render bridge; `extensions.md` confirms no existing first-class display-only transcript API.

### Context
- Current jj state before this checkpoint: working copy `kzkknknl` on top of `wpmzmzty 121f5b0d`; `.sandpiper/standup.md` was already modified, and creating/updating TAT-34/TAT-35 added task file changes.
- Keep using Chorus participation rules: reply only when addressed/own lane/new info/silence blocks; use `done` for no-op turns.

## Session 019e51bf-9ff6-7044-897e-24ff87b27adb (Updated: 2026-05-25T14:55:06.511Z)

Session file: /Users/doug.stephen/.sandpiper/agent/identities/Huginn/sessions/2026-05-22T22-12-53-366Z_019e51bf-9ff6-7044-897e-24ff87b27adb.jsonl

### Accomplished
- Live-smoked amended final cosmetic slice in `final-exams-pt2`; Huginn replied to Doug’s check-in request and used `done` for non-actionable follow-ups.
- Investigated Doug’s new observation: when Piper was hung mid-turn, incoming Chorus messages did not render live until later/turn boundary.
- Collated source/API facts: `pi.appendEntry()` is extension-private `custom` persistence only, no live renderer/event path; renderable custom messages are `CustomMessageEntry` via `pi.sendMessage()`, which currently also participates in LLM context.
- Piper confirmed hung-period messages persisted in its session JSONL as `custom_message` entries, so likely visual/live-render delay rather than transport drop.

### In Progress
- Open design follow-up: decouple visible display from model-visible custom message injection for Chorus/live room traffic.
- Huginn remains Scout/collator; Piper/Muninn contributed source/UX slices.

### Next Session
- If implementing, prefer new host/API path like `appendDisplayMessage` / `sendDisplayMessage`: render/persist visible custom message immediately, ignored by LLM context.
- Keep separate hidden/model-visible `custom_message` queued through normal context semantics; dedupe via caller-provided key such as `chorus:<postId>`.
- Do not repurpose `pi.appendEntry()` as-is; its contract is extension-private state persistence.
- Return to VCG CORE-1606 source-accuracy review when Chorus is parked.

### Blockers / Findings
- No code blocker currently, but new design issue: `pi.sendMessage` couples live rendering to model injection and queues while streaming, so hung turns can hide incoming Chorus traffic visually.

### Context
- Latest Scout-clear slices: `mnpqnnsn`, `lzkywlvt` + `utxmwlyn`, `pwpzxpkv`, amended `wpmzmzty` / `121f5b0d`.
- Latest room: `final-exams-pt2`.
