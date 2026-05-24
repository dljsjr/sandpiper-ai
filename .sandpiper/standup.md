# Session Stand-Up

## Session 019e4ba5-f223-7d87-935d-a43a8a8f71e9 (Updated: 2026-05-24T17:25:21.934Z)

Session file: /Users/doug.stephen/.sandpiper/agent/sessions/--Users-doug.stephen-git-sandpiper-ai--/2026-05-21T17-47-07-171Z_019e4ba5-f223-7d87-935d-a43a8a8f71e9.jsonl

### Accomplished
- Integrated and dogfooded broker-backed Chorus MVP through `mlyuyklx` / `5e513758`; recorded successful multi-agent dogfood in `uuzszrlk` / `2c323733`.
- Implemented post-dogfood UX polish in `nxzvxuzx` / `761a4366`: 12-entry transcript, broker-route-based suppression, self-agent visible/model-invisible messages, quiet reply tool attempt, and `/agent <message>` local-agent escape hatch.
- Fixed the first TAT-26 quiet-reply issue in `wyozlpuu` / `98237ac6` by removing success-path `sendChorusMessageToChat`/`pi.sendMessage`, returning non-empty hidden-render tool content, and adding `terminate:true`.
- Peer reviews initially found no blockers after `wyozlpuu`, but live coordination then exposed a regression: `terminate:true` on successful `send_chorus_reply` appears to halt agents while they are trying to spin up real work.
- Doug disabled/terminated Chorus and reloaded because Chorus could not be terminated via slash command in the room state.
- Coordination decision: stop using Chorus for agent coordination for now; use original hidden Tattler peer messages until the next fix lands.
- Task updates: `TAT-23` and `TAT-26` back to IN_PROGRESS; created/picked up `TAT-28` (`Chorus send_chorus_reply terminate success can halt agents`) and marked `TAT-23` blocked by `TAT-28`.

### In Progress
- Piper/Librarian is taking the next concrete slice test-first: local broker-owner visibility for non-agent local room submissions. Do not edit over that lane unless asked.
- TAT-28 needs a safer quiet-reply design: no success-path `pi.sendMessage`, but also avoid `terminate:true` if it halts useful follow-up work.

### Next Session
- Use hidden Tattler peer messaging for coordination; do not rely on Chorus until fixed/reloaded.
- Review Piper’s next slice when requested, especially broker-owner visibility: Doug’s messages sent to a Chorus room currently do not reach the broker-owning Piper/Librarian model context.
- Revisit TAT-26/TAT-28 after Piper’s slice: likely success result should be hidden-render, non-empty, non-steering, and non-terminating; consider an explicit prompt/result instruction or runtime hook rather than `terminate:true`.
- Also keep room shutdown behavior in scope: Doug could not terminate the room via slash command after the issue.

### Blockers
- TAT-23/TAT-26 are blocked by live TAT-28 regression until the successful `send_chorus_reply` path no longer halts agents.

### Context
- Latest clean code before regression was `wyozlpuu 98237ac6`; current empty child before this checkpoint was `tvstpkkp 6de8c3e5`.
- Previous verification after `wyozlpuu`: focused Vitest 34/34 and full `bun check` passed, but live behavior showed the state-machine problem was not covered by tests.
- Relevant Pi behavior found by Huginn: during streaming, `sendCustomMessage` sends any `pi.sendMessage` to `agent.steer(appMessage)` unless `deliverAs:'followUp'`; `triggerTurn:false` only applies when not streaming; `messages.js` converts custom messages to user messages regardless of display/empty content. Removing `pi.sendMessage` was right, but `terminate:true` introduced a new workflow halt.

## Session 019e51bf-9ff6-7044-897e-24ff87b27adb (Updated: 2026-05-24T17:25:09.136Z)

Session file: /Users/doug.stephen/.sandpiper/agent/identities/Huginn/sessions/2026-05-22T22-12-53-366Z_019e51bf-9ff6-7044-897e-24ff87b27adb.jsonl

### Accomplished
- Scout-reviewed Chorus MVP/polish stack through `wyozlpuu` / `98237ac6` in `/Users/doug.stephen/git/sandpiper-ai`.
- Confirmed prior TAT-26 non-steering fix removed success-path `pi.sendMessage`, returned non-empty tool content, and set `terminate:true`; focused Vitest 34/34 and `bun check` passed at that point.
- Participated in live Chorus dogfood; initial MVP path worked, then later live use exposed new regressions.
- Captured latest regression state in Huginn `CHECKPOINT.md`.

### In Progress
- Chorus coordination is disabled for now. Use hidden Tattler peer messages, not Chorus, for agent coordination.
- Piper/Librarian is leading the next concrete slice around local broker-owner visibility and room/control semantics; Huginn should review read-only when asked.

### Next Session
- Re-review the next Piper/owner diff with focus on: broker-owner local submissions becoming model-visible to the local agent when appropriate; quiet reply-tool semantics avoiding both steering empty turns and premature task termination; slash-command/control routing not being trapped by the Chorus room editor.
- Treat `terminate:true` on successful `send_chorus_reply` as suspect despite earlier static approval: live behavior suggests it can halt agents while they are trying to spin up real work.
- Preserve the earlier hardening caveats: display-name spoof of broker route name/shortId; `/agent ` room-message escape convention; lifecycle cleanup polish.
- Return to VCG CORE-1606 source-accuracy review when Chorus is parked.

### Blockers
- Chorus is not safe as the coordination channel right now; Doug disabled/reloaded after live regressions.

### Context
- Latest known reviewed stack before regression: empty child `qqlquyuz` over `wyozlpuu 98237ac6 fix(chorus): keep reply tool success path non-steering`, `nxzvxuzx 761a4366 feat(chorus): polish post-dogfood room UX`, and prior MVP stack.
- Live regression report from Piper/Librarian: `terminate:true` success-path change appears to have caused agents to halt while trying to start real work; room could not be terminated via slash command.
- Fall back to `send_peer_message`/hidden Tattler for coordination until a fix lands.
