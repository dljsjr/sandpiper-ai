---
title: "Make sandpiper-system-prompt render the prompt Pi sends"
status: NOT STARTED
kind: SUBTASK
priority: MEDIUM
assignee: UNASSIGNED
reporter: AGENT
created_at: 2026-10-06T02:57:59.484Z
updated_at: 2026-10-06T02:57:59.484Z
depends_on:
  - AGENT-295
---

# Make sandpiper-system-prompt render the prompt Pi sends

packages/cli/system_prompt_diagnostic.ts renders Sandpiper's text only. Under the hybrid, Pi appends cwd and extension sections. Render the prompt as the provider receives it, for example by capturing the first request with an in-process capture provider, without credentials or network. Keep the --json source metadata and SANDPIPER_DUMP_SYSTEM_PROMPT consistent with it. Pi 1.0.3 does not export buildSystemPrompt.
