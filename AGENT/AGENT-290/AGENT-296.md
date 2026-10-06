---
title: "Let Pi render its tools and rules sections under Sandpiper's prompt"
status: NOT STARTED
kind: SUBTASK
priority: HIGH
assignee: UNASSIGNED
reporter: AGENT
created_at: 2026-10-06T02:57:59.409Z
updated_at: 2026-10-06T18:23:49.723Z
depends_on:
  - AGENT-295
---

# Let Pi render its tools and rules sections under Sandpiper's prompt

Decision (2026-10-06): do what Pi does for tool text. See the spec's Tool sections decision note and Local Pi patch section.

Steps:
1. Tests, red on stock 1.0.4, using the AGENT-295 harness:
   - Pi's `rules` section contains every guideline Sandpiper rendered on Pi 0.85.1 for the same tools (the 22 bullets the discovery probe lost).
   - Hidden tools are absent from `tools` and `rules`.
   - After an active-tool change between user prompts, within a run, and during an idle synthetic turn, the next request's `tools` and `rules` sections and tool declarations match the active tools.
   - Sandpiper's preamble contains no tool list or tool guidelines.
2. Extend the local pi-coding-agent patch from AGENT-295:
   - dist/core/system-prompt.js: a customPrompt no longer suppresses Pi's `tools` and `rules` sections. `docs` stays suppressed.
   - dist/core/agent-session.js: idle synthetic runs re-render `tools` and `rules` from the active tools, while keeping every other recorded section.
3. Delete Sandpiper's own tool block: toolGuidanceBlock(), normalizePromptGuidelines(), the tool list in packages/core/src/system-prompt.ts, the toolGuidanceContentBlock dump entry, and their tests. Pi 1.0.4 already keeps hidden tools out of `tools` and `rules` (c30840c2e).
4. Gates, then one jj change with `Refs: AGENT-296`.

Done when: those tests pass, bun check is clean, and bun run test is green.

History (2026-10-06): absorbed the tool-guideline coverage from AGENT-294. Replaced the earlier plan to render toolGuidelines and hiddenTools in Sandpiper's own tool block.

---

# Activity Log

## 2026-10-06T15:51:34.016Z

- **description**: 1 line → updated (7 lines)

## 2026-10-06T16:38:40.697Z

- **title**: Render per-tool toolGuidelines and honor hiddenTools in the Sandpiper tool block → Let Pi render its tools and rules sections under Sandpiper's prompt
- **description**: 7 lines → updated (17 lines)

## 2026-10-06T18:23:49.724Z

- **description**: updated
