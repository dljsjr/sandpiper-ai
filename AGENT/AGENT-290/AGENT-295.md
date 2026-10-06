---
title: "Implement prompt ownership and the Shape B Pi patch"
status: COMPLETE
resolution: DONE
kind: SUBTASK
priority: HIGH
assignee: AGENT
reporter: AGENT
created_at: 2026-10-06T02:57:59.333Z
updated_at: 2026-10-06T20:30:59.711Z
depends_on:
  - AGENT-293
---

# Implement prompt ownership and the Shape B Pi patch

Implement the System prompt section of .sandpiper/docs/specs/agent-290-pi-1-0-migration-spec.md (Ownership, and the synthetic-runs part of Local Pi patch) in extensions/system/startup-hooks.ts and packages/core.

Steps:
1. Test harness. Build an in-process harness: createAgentSession with the real createSandpiperIdentityExtension(), a temp agent dir, an in-memory or temp SessionManager, and a recording provider that captures each request's TranscriptContext. Start from the scratch probes /tmp/sp-pi1/probe-hybrid.ts and /tmp/sp-pi1/probe-sections.ts. They are scratch and may be gone after a reboot; the pattern is createAgentSession plus a provider registered in-process. AGENT-296 and AGENT-297 reuse this harness, so put it where both can import it.
2. Tests, red on stock 1.0.4. Assert the spec's Invariants except the tool-section rows, which belong to AGENT-296. Cover user-prompted runs, idle synthetic runs including a second turn, the first-turn gap as the documented exception, a resumed session, session.state.systemPrompt as /export renders it, byte-for-byte request prefix stability across idle synthetic turns, and an extension-added section such as mcp_servers. Confirm each fails for the reason the invariant names.
3. Ownership in extensions/system/startup-hooks.ts:
   - In before_agent_start, set systemPromptOptions.customPrompt to the rendered prompt.
   - Clear appendSystemPrompt, contextFiles, and skills.
   - Return nothing.
   - Leave toolSnippets, toolGuidelines, and promptGuidelines intact; Pi's rules section needs them in AGENT-296.
   - Keep the lastKnownSystemPrompt canary.
   - Drop <cwd> from environmentBlock() in packages/core/src/system-prompt.ts.
   Sandpiper's own tool block stays until AGENT-296 removes it.
4. Shape B. Run `bun patch @earendil-works/pi-coding-agent` and edit dist/core/agent-session.js. In prepareNextTurnWithContext, when _runSystemPromptOptions is undefined (a run that skipped before_agent_start), keep the transcript's recorded sections instead of diffing base options against them, and still apply tool loadout changes. Then check whether a synthetic run's first turn also reverts on 1.0.4. The 1.0.3 probe saw the revert only from turn 2. Commit the patch file and the patchedDependencies entry.
5. Distribution. Confirm the built runtime loads the patched agent-session.js: distribution copies Pi's dist/core from node_modules.
6. Gates, then one jj change with `Refs: AGENT-295`.

Done when: the new tests pass, bun check is clean, bun run test is green, and the distribution gate is green.

History (2026-10-06): absorbed AGENT-294, because tests are part of the implementation they verify. The earlier context_with_system guard design is superseded by Shape B; see the spec's Ownership decision note.

---

# Activity Log

## 2026-10-06T15:17:17.269Z

- **title**: Implement hybrid system prompt ownership with a context_with_system guard → Implement prompt ownership and the Shape B Pi patch

## 2026-10-06T15:17:17.402Z

- **description**: 1 line → updated (3 lines)

## 2026-10-06T15:49:53.307Z

- **description**: 3 lines → updated (11 lines)

## 2026-10-06T18:23:49.656Z

- **description**: 11 lines → updated (20 lines)

## 2026-10-06T18:58:22.514Z

- **status**: NOT STARTED → IN PROGRESS
- **assignee**: UNASSIGNED → AGENT

## 2026-10-06T19:06:30.078Z

- **status**: IN PROGRESS → NEEDS REVIEW

## 2026-10-06T20:30:59.712Z

- **status**: NEEDS REVIEW → COMPLETE
- **resolution**: DONE
