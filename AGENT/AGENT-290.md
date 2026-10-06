---
title: "Migrate Sandpiper to Pi 1.0 SDK architecture"
status: IN PROGRESS
kind: TASK
priority: HIGH
assignee: AGENT
reporter: USER
created_at: 2026-10-05T21:08:10.437Z
updated_at: 2026-10-06T19:42:59.157Z
related:
  - AGENT-289
  - TOOLS-27
---

# Migrate Sandpiper to Pi 1.0 SDK architecture

Upgrade Sandpiper from @earendil-works/pi-* 0.85.1 to Pi 1.0.x using the new SDK-like architecture.

Begin with discovery, not edits:

1. Read the installed Pi 1.0.3 package at `/Users/dstephen/.local/share/mise/installs/npm-earendil-works-pi-coding-agent/latest/node_modules/@earendil-works/pi-coding-agent/`. Start with `README.md`, `docs/index.md`, `docs/sdk.md`, `docs/extensions.md`, `docs/packages.md`, `docs/sessions.md`, `docs/session-format.md`, and `docs/message-types.md`, then inspect relevant examples. Do not use the repository's `node_modules` docs as the migration authority; they remain at 0.85.1 until the upgrade. Note: the global package manifest reports 1.0.3 while `pi --version` currently reports the misleading value 0.0.1.
2. Inventory Sandpiper's Pi integration surfaces before changing dependencies: package manifests, CLI/bootstrap code, Pi adapters, extensions and lifecycle hooks, custom tools, TUI, providers/models, session persistence, RPC/headless paths, distribution assembly, standalone app, and tests.
3. Compare 0.85.1 behavior and types against 1.0.3, identifying removed APIs, compatibility bridges that can disappear, and new SDK-owned responsibilities.
4. Write a migration design and executable work plan before implementation. Preserve behavior unless a deliberate Pi 1.0 architectural change supersedes it; divide the migration into independently verifiable increments.
5. Reassess build/distribution and clean-output design during the migration rather than refactoring the 0.85 build first.

Verified baseline: AGENT-289 change `tovpqyxx` / `5351f91f`; TOOLS-27 change `sovyuuyx` / `c4c0ae97`. The sterile pre-upgrade tree passed a frozen install, an uncached package build, `bun check`, the full distribution gate, and 126 files / 1,152 Vitest tests.

Discovery complete (2026-10-05). Platform decided: stay on pi-coding-agent 1.0.x; no Pi Durable rebuild.

- Rationale and evidence: .sandpiper/docs/specs/agent-290-pi-1-0-discovery.md
- Normative phase 1 behavior: .sandpiper/docs/specs/agent-290-pi-1-0-migration-spec.md
- Sequence, gates, and provider coordination: .sandpiper/docs/specs/agent-290-pi-1-0-migration-work-plan.md

Phase 1 subtasks: AGENT-293 and AGENT-295 to AGENT-302. Prompt mechanism: customPrompt ownership plus one local Pi patch: Shape B for synthetic runs, and Pi's own tools and rules sections under customPrompt. See the spec's Ownership decision notes.

Done when every subtask is complete and the built Sandpiper passes this end-to-end check on Pi 1.0, interactively and headless: fullscreen TUI with Chorus room UI, Tattler pending-batch and diagnostics entry renderers, background-process and Tattler wakes, /export, resume of a 0.85-era session, RPC and print modes. Repeat the check with the migrated pi-claude-code-cli-provider once its own migration lands (PCCP-304 in that repo). Record regressions as bugs. Until this passes, the default workspace stays on Pi 0.85.1.

History (2026-10-06): absorbed AGENT-303. End-to-end verification is the parent's done criteria, not a separate task.

End-to-end progress (2026-10-06, built dist/sandpiper from the pi1 workspace at change pvmntoqp, temp agent dir, scratch recording provider):
- Print mode, resuming a copy of a 0.84/0.85-era session (2026-08-06): the request carries the Sandpiper prompt plus Pi's tools/rules/cwd sections and 14 tools; no Pi default text.
- RPC mode, background-process wake: the idle synthetic wake turn carries the Sandpiper prompt; no reverting system message.
- RPC mode, Tattler wake from a live 0.85 Sandpiper peer: delivered as <tattler_inbox>, with the Sandpiper prompt and no reverting system message.
- TUI (pty capture), fullscreen and regular: Sandpiper header, key hints, and the loaded-resources list render; no Pi logo.
- --export of a session to HTML works from the narrowed Pi assets.
Joint check with migrated pi-claude-code-cli-provider (PCCP-304 joint build pnrqvzuy, claude-cli/haiku, RPC): user prompt, tool call, background-process wake, mid-run tool change (tools/list_changed; next user frame carried one <system_prompt_update> for tools), Tattler wake from a live 0.85 peer, and resume of a copied 0.85 session all pass. Found and fixed on the PCCP side: stream events used snake_case content_index/tool_call (PCCP-325). Open on the PCCP side: a resumed pre-1.0 session gets its first system message after the legacy history, so CC starts with an empty system prompt and receives Sandpiper's prompt as an update frame.
Remaining: live interactive dogfood by Doug (fullscreen Chorus room UI, Tattler pending-batch and diagnostics entry renderers, /export from the TUI).

---

# Activity Log

## 2026-10-05T21:12:55.705Z

- **description**: 1 line → updated (11 lines)

## 2026-10-05T21:47:30.646Z

- **status**: NOT STARTED → IN PROGRESS
- **assignee**: UNASSIGNED → AGENT

## 2026-10-06T02:59:24.352Z

- **description**: 11 lines → updated (19 lines)

## 2026-10-06T15:49:37.503Z

- **description**: 19 lines → updated (23 lines)

## 2026-10-06T16:38:44.770Z

- **description**: updated

## 2026-10-06T19:29:27.644Z

- **description**: 23 lines → updated (31 lines)

## 2026-10-06T19:42:59.158Z

- **description**: 31 lines → updated (32 lines)
