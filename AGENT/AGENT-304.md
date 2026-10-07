---
title: "Align Birdup and its prompt editor with the Pi 1.0 migration"
status: IN PROGRESS
kind: TASK
priority: HIGH
assignee: AGENT
reporter: USER
created_at: 2026-10-07T14:03:51.864Z
updated_at: 2026-10-07T14:04:03.938Z
related:
  - AGENT-290
  - AGENT-266
  - AGENT-297
---

# Align Birdup and its prompt editor with the Pi 1.0 migration

Doug deferred these during AGENT-290 (2026-10-06); picked up 2026-10-07. Repos: ~/git/birdup (default workspace has uncommitted WIP that is not ours: pi-ext/*.ts, cli.py, content.py, prompt resources, mise.toml) and the jj workspace ~/git/birdup-markdown-editor. Coordinated with birdup-agent over Tattler.

What changed in Sandpiper that Birdup sees:
- sandpiper-system-prompt --json: 'prompt' is now the prompt the provider receives. That is Sandpiper's <system_prompt>…</system_prompt> followed by Pi-rendered <tools>, <rules>, <cwd> and any extension sections. Sandpiper's own <tools>/<available_tools>/Guidelines block is gone, and <environment> no longer has <cwd>.
- Birdup's launch flags (--approve, --tattler-id, --session-dir, --memory-file, --identity, --append-system-prompt, --extension) work on Pi 1.0. before_agent_start returning { message } (clock.ts, persona_latch.ts) is still supported.

Done when: birdup's tests and prompt editor work against the Pi 1.0 output (live check by launching birdup <identity> --edit-prompt), and the editor shows Pi's sections as read-only.

---

# Activity Log

## 2026-10-07T14:04:03.939Z

- **status**: NOT STARTED → IN PROGRESS
- **assignee**: UNASSIGNED → AGENT
