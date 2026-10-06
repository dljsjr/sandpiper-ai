---
title: "Make sandpiper-system-prompt render the prompt Pi sends"
status: COMPLETE
resolution: DONE
kind: SUBTASK
priority: MEDIUM
assignee: AGENT
reporter: AGENT
created_at: 2026-10-06T02:57:59.484Z
updated_at: 2026-10-06T20:30:59.835Z
depends_on:
  - AGENT-295
---

# Make sandpiper-system-prompt render the prompt Pi sends

packages/cli/system_prompt_diagnostic.ts renders Sandpiper's text only. On Pi 1.0, Pi adds its own sections after Sandpiper's preamble: tools, rules, cwd, and extension sections such as mcp_servers. The diagnostic must show the prompt the provider receives. Pi 1.0.4 does not export buildSystemPrompt.

Steps:
1. Test first: the diagnostic's output equals the system prompt a recording provider captures for the same session, using the AGENT-295 harness.
2. Render by running one turn against an in-process capture provider, with no credentials or network, and taking getCurrentSystemPrompt() of the first request.
3. Keep --json's source metadata. Mark Pi-rendered sections as generated.
4. Make SANDPIPER_DUMP_SYSTEM_PROMPT=1 print the same text.
5. Gates, then one jj change with `Refs: AGENT-297`.

Out of scope (Doug, 2026-10-06): Birdup's `--edit-prompt` runs `sandpiper-system-prompt` and may need changes. That waits until after the migration, at low priority.

Done when: `sandpiper-system-prompt --approve` output equals the prompt captured by a recording provider, bun check is clean, and bun run test is green.

---

# Activity Log

## 2026-10-06T18:23:49.789Z

- **description**: 1 line → updated (11 lines)

## 2026-10-06T18:36:12.079Z

- **description**: 11 lines → updated (12 lines)

## 2026-10-06T19:15:26.726Z

- **status**: NOT STARTED → IN PROGRESS
- **assignee**: UNASSIGNED → AGENT

## 2026-10-06T19:15:26.838Z

- **status**: IN PROGRESS → NEEDS REVIEW

## 2026-10-06T20:30:59.835Z

- **status**: NEEDS REVIEW → COMPLETE
- **resolution**: DONE
