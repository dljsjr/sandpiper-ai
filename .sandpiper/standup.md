# Session Stand-Up

## Session 019e4ba5-f223-7d87-935d-a43a8a8f71e9 (Updated: 2026-05-24T17:58:16.239Z)

Session file: /Users/doug.stephen/.sandpiper/agent/sessions/--Users-doug.stephen-git-sandpiper-ai--/2026-05-21T17-47-07-171Z_019e4ba5-f223-7d87-935d-a43a8a8f71e9.jsonl

### Accomplished
- Reviewed Piper’s slash escape and registered `/agent` slices: `nksywrlm` / `243a74ca` (`feat(chorus): support literal slash room messages`) and `tuwrwlly` / `032bc236` (`feat(chorus): register local agent escape command`). No blockers. Verification here: focused Vitest subset 17/17, full `bun check`, lizard clean.
- Piper reported full verification for those slices: focused Vitest 40/40, full `bun check`, lizard clean.
- Created/picked up `TAT-29`: investigate suppressing assistant follow-up after Chorus replies. Initial conclusion: prompt-only is soft; hidden renderer/non-empty tool result reduces UI noise but cannot enforce no assistant text; `terminate:true` is the only current enforceable loop knob but is too blunt when baked into `send_chorus_reply`; a true solution likely needs either a dedicated explicit `done`/`finish_turn` tool or harness/agent-loop support for scoped post-tool continuation suppression.
- Created `TAT-30`: make `/agent` escape hatch discoverable. Piper implemented it as a registered `/agent` command plus Chorus editor passthrough. Remaining caveat: `/agent` is globally visible and may need state-aware wording later.
- Doug opened next fixes in Chorus room `more-chorus-fixes`; tracked them:
  - `TAT-31` BUG: Fix Chorus multiline room message rendering. Assigned to Librarian.
  - `TAT-32` TASK: Design general quiet completion tool for no-assistant-message turns. Assigned to Librarian.
  - `TAT-33` TASK: Brainstorm Chorus reply storm and context growth controls. Assigned to AGENT.
- Added descriptions to TAT-31/32/33 capturing Doug/Muninn/Huginn guidance.

### In Progress
- Librarian/Piper is taking `TAT-31` and `TAT-32`; do not edit over that lane unless asked.
- Piper/this session owns `TAT-33` brainstorm.
- Current working copy has task/standup changes only as of this checkpoint; code work for TAT-31/32 should be in Librarian’s lane.

### Next Session
- For TAT-31 review: newline rendering should be fixed in the room widget renderer, not protocol. Preserve raw message text, split/sanitize for display, indent continuation rows under sender tag, cap/truncate long multiline content. Regression tests should include `hello\nworld`, leading/trailing blank lines, and long wrapped multiline content.
- For TAT-32: avoid naming the tool `ignore`; prefer `done`, `finish_turn`, or `no_response_needed`. It should be generic/system-owned, no params, no rendered output, probably returns `terminate:true`, with strict guidance: only use after requested visible action already happened elsewhere or explicit no-response-needed instruction; never for normal requests, uncertainty, errors, or remaining work. Need verify batching semantics so it doesn’t repeat the `send_chorus_reply` regression.
- For TAT-33: start with social/protocol-light controls, not transport suppression: Chorus notification guidance should say agents reply only if directly addressed, they own a lane, have new information, need to answer a question, or silence would block progress. Consider `@name`, `@all`, broker/owner summaries, and quiet/observe participant mode later. Full turn-taking/election is larger design.
- Continue hidden Tattler for coordination if Chorus is under active modification or behaving noisily.

### Blockers
- None for current clean slices, but context is high; resume from this standup if compacted.

### Context
- Current jj stack before this checkpoint: empty child `utwzlwsy` / `8b85860e` on top of `xxynxsnw 8e4a1963` (silent-reply investigation checkpoint), `tuwrwlly 032bc236`, `nksywrlm 243a74ca`, `oppwllpw 79f84c92`, `osrvxsxo fe18be6c`, and earlier Chorus stack.
- Pi internals read so far: `agent-loop.js` always appends finalized tool results as `toolResult` messages; `terminate:true` only stops the inner tool-call/continuation loop when every tool result in the batch has terminate true. `agent-session.js` shows streaming `sendCustomMessage` queues custom messages to `agent.steer()` unless `deliverAs:'followUp'`; `triggerTurn:false` only matters when not streaming.

## Session 019e51bf-9ff6-7044-897e-24ff87b27adb (Updated: 2026-05-24T17:58:04.185Z)

Session file: /Users/doug.stephen/.sandpiper/agent/identities/Huginn/sessions/2026-05-22T22-12-53-366Z_019e51bf-9ff6-7044-897e-24ff87b27adb.jsonl

### Accomplished
- Scout-reviewed latest Chorus slices through `tuwrwlly` / `032bc236`; no blockers found.
- Captured latest `more-chorus-fixes` design/input from Doug: multiline chat-log rendering bug, generic quiet/done tool idea, and reply-storm/context blow-up problem.
- Updated Huginn checkpoint with current review verdicts and next-review lenses.

### In Progress
- Piper/Librarian is taking the next slice: multiline room transcript rendering first, test-first.
- Then likely inspect/implement a general `done`/quiet/no-response tool and brainstorm reply-throttling.
- Huginn is read-only Scout/reviewer; avoid extra Chorus ACK noise unless there is a real finding/question.

### Next Session
- Review multiline rendering fix with focus on preserving raw protocol text and fixing only widget rendering: split/sanitize lines, continuation indentation, blank-line behavior, long multiline cap/truncation, and tests.
- For generic quiet tool, avoid `ignore` naming if possible; require narrow guidance. It should only terminate the current follow-up after another requested visible action already happened or when no assistant response is explicitly requested.
- For reply storms, prefer v0 participation norms/addressing before transport suppression: agents reply only when directly addressed, lane-owning, adding new info, answering a question, or preventing a block.
- Return to VCG CORE-1606 source-accuracy review when Chorus is parked.

### Blockers
- No current Scout blockers on latest reviewed Chorus slices.
- Open design questions: safe quiet/done tool semantics and reply-storm controls.

### Context
- Latest reviewed slices: `osrvxsxo`, `nksywrlm`, `tuwrwlly`; all Scout-clear.
- New room: `more-chorus-fixes`, broker `chorus:more-chorus-fixes:Librarian`.
- Multiline bug is product rendering, not protocol mutation: preserve raw message bodies.
