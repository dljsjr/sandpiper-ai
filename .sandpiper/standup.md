# Session Stand-Up

## Session 019e8b87-3d9e-79a9-8a46-9456824fb636 (Updated: 2026-06-03T04:51:44.613Z)

Session file: /Users/doug.stephen/.sandpiper/agent/identities/Huginn/sessions/2026-06-03T03-29-16-702Z_019e8b87-3d9e-79a9-8a46-9456824fb636.jsonl

### Accomplished
- Implemented AGENT-212: slimmed tool `promptGuidelines` and clarified tool routing.
- Added `normalizePromptGuidelines()` in `packages/core/src/system-prompt.ts` to trim, drop empty guidelines, keep filtering `Be concise in your responses`, and byte-identical dedupe guideline lines before rendering the global `Guidelines:` block.
- Cut/merged hot guidance across `extensions/chorus.ts`, `extensions/tattler/index.ts`, `extensions/tattler/tattler-receive.ts`, `extensions/system/turn-control-tool.ts`, `extensions/system/background-process-tools.ts`, `extensions/system/skill-loading-tool.ts`, and `extensions/shell-relay/src/tools/start-relay.ts`.
- Banked Doug's routing correction: `shell_relay` is only for genuine live shell/session state; chaining commands or long-running work is not a reason to use it. Use `start_background_process` + `check_background_process` for long work and `bash` for general commands.
- Marked AGENT-212 `NEEDS REVIEW` and committed the work as `ad922ff5 fix: slim tool prompt guidelines` (`Refs: AGENT-212`).

### In Progress
- No code changes remain in the working copy after commit. Current jj `@` is empty on top of `ad922ff5`.

### Next Session
- Review the prompt-guidance commit if Doug wants another pass: `jj show pqwqvlzw` (change id for `fix: slim tool prompt guidelines`).
- If approved, finalize AGENT-212 from `NEEDS REVIEW` to complete.
- Separate parked finding remains: `multi_tool_use.parallel` is bound/callable but absent from the `<available_tools>` catalog; treat as schema/registration/catalog work, not promptGuidelines cleanup.

### Blockers
- None.

### Context
- Focused tests passed: `bun run test:vitest -- packages/core/src/system-prompt.test.ts extensions/chorus.test.ts extensions/system/turn-control-tool.test.ts extensions/system/skill-loading-tool.test.ts extensions/system/background-process-tools.test.ts`.
- Full check passed: `bun check`.
- Rough guideline size after cleanup: registered guideline lines around 18 lines / ~695 rough tokens before assembly dedupe, 16 rendered unique lines / ~616 rough tokens after dedupe.
