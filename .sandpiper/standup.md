# Session Stand-Up

## Session 019e4ba5-f223-7d87-935d-a43a8a8f71e9 (Updated: 2026-05-23T06:56:02.730Z)

Session file: /Users/doug.stephen/.sandpiper/agent/sessions/--Users-doug.stephen-git-sandpiper-ai--/2026-05-21T17-47-07-171Z_019e4ba5-f223-7d87-935d-a43a8a8f71e9.jsonl

### Accomplished
- TAT-13 (Finish Tattler module split and registration plumbing) was stabilized and moved to NEEDS REVIEW.
- Split Tattler now lives under `extensions/tattler/` (`index.ts`, `tattler-protocol.ts`, `tattler-identity.ts`, `tattler-ipc.ts`, `tattler-runtime-dir.ts`, `tattler-pi-events.ts` placeholder).
- Updated Tattler registration import paths in `packages/cli/sandpiper_resources.ts` and `plugins/pi/extensions/tattler.ts` to `extensions/tattler/index.js`.
- Added `packages/core/src/utils.ts` (`sessionShortIdGenerator`, `withTimeout`, `errorMessage`, `isRecord`) and exported it from `packages/core/src/index.ts`.
- Fixed a behavior regression in `extensions/tattler/tattler-runtime-dir.ts`: `firstDefined()` again catches candidate failures and tries the next runtime-dir candidate.
- Formatted/linted touched Tattler/Chorus/core files and removed a non-null assertion in `extensions/chorus.ts`.
- Verified TAT-13 with: `bun run check:tsc`, `bun x biome check extensions/tattler extensions/chorus.ts packages/core/src/index.ts packages/core/src/utils.ts`, `bun check`, and `bun run test:vitest -- packages/cli/sandpiper_resources.test.ts`.
- Coordinated with Librarian via Tattler. Librarian has isolated workspace `/Users/doug.stephen/git/sandpiper-ai-piper-chorus-contracts`, change `sxlzvyqk` (`feat(tattler): add Chorus room contracts`) for TAT-14/TAT-16.
- Reviewed Librarian's contracts slice and sent findings: request/response channels need correlation or callback payloads; `listPeers.response` currently equals request channel; room post handler should likely support async; document source identity invariant.

### In Progress
- TAT-15: Chorus v0 direction is now an ephemeral physical room broker/channel, not broadcast editor mode. Regular Pi chat is DM; Chorus room content should be only Tattler/Chorus messages.
- `extensions/chorus.ts` is still placeholder/red terrain from the earlier broadcast-editor sketch and not considered complete.
- `extensions/tattler/tattler-pi-events.ts` in main working copy is placeholder terrain for TAT-16 and not considered final.

### Next Session
- Review/fix/merge Librarian's TAT-14/TAT-16 contracts after addressing review findings.
- Keep TAT-13 review focused on split behavior and registration paths; event-bus/room contracts belong to TAT-16/TAT-14.
- Begin implementation order after contracts settle: TAT-17 broker endpoint, TAT-18 fanout, TAT-19 replies to broker, TAT-20 room TUI.

### Blockers
- None for TAT-13; it is ready for review.
- TAT-15 implementation should wait for TAT-14/TAT-16 contract shape to settle.

### Context
- Design decision: Chorus rooms are first-class Tattler endpoints with a physical broker socket. Local and remote agents should be symmetric participants; do not special-case local agent replies through local editor capture.
- Broker owns room ID, participant set, transcript/rendering state, fanout policy, and delivery/ACK status. Composer posts to broker; broker records/renders then fans out; participant replies return to broker.
- Prefer non-blocking event-bus state machines over awaiting readiness in extension factories. Pi event bus is simple and in-process; callback-in-payload reply functions may be cleaner than shared response channels with correlation IDs.
