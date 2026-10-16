---
title: "Assess Pi 1.0.4 → 1.3.0 changes for Sandpiper"
status: COMPLETE
resolution: DONE
kind: TASK
priority: HIGH
assignee: UNASSIGNED
reporter: USER
created_at: 2026-10-16T16:14:05.652Z
updated_at: 2026-10-16T17:08:15.119Z
related:
  - AGENT-290
---

# Assess Pi 1.0.4 → 1.3.0 changes for Sandpiper

Pi went from 1.0.4 to 1.3.0 (1.1.0 on 2026-10-07, 1.2.0 on 10-12, 1.3.0 on 10-15). Review everything added or changed, not just the #5581 fix: what Sandpiper must change, what it can drop (the local patch), and what it can build on. Discovery only; an upgrade plan follows.

Findings (2026-10-16, from the coding-agent/ai/agent/tui CHANGELOGs at v1.3.0 plus checks of Sandpiper, Birdup, PCCP, reinforced-guidance, and pi-yaams code):

Must do on the bump
- Redo the local patch. Drop the Shape B part: 1.2.0 (PR #10739, closes #5581) runs before_agent_start for triggerTurn runs. Keep the tools/rules part: in 1.3.0, customPrompt still suppresses tools/rules (system-prompt.ts:152).
- Update prompt-ownership.test.ts: the first-turn-gap test's expectation flips (a synthetic first run now gets the Sandpiper prompt).
- BeforeAgentStartEvent is now a union on messageType ("user" carries prompt/images; "custom" carries message). Sandpiper's handlers don't read prompt or images. tattler-inbox-hooks now also drains the pending inbox on custom runs, which is beneficial. startup-hooks re-renders the prompt on wakes (cheap; the canary is unchanged if inputs are).
- Compiled app: add autoloadDotenv: false next to autoloadBunfig: false in devtools/standaloneSandpiperApp.ts (Pi 1.1.0 #10473 fixed the same in its own binary). Moot if TOOLS-30 drops the compiled app.

- The npm global-install smoke test (devtools/npmPackageInstallSmoke.test.ts) currently fails on 1.0.4: pi-coding-agent 1.0.4 declares @earendil-works/pi-codemode as ^1.0.4, so a fresh npm install resolves pi-codemode 1.3.0, which removed MCP_TYPESCRIPT_PREAMBLE. The lockfile keeps local runs on 1.0.4. Pi 1.3.0 pins its own packages exactly (#10865), so the bump fixes it. Expect this one red test until then.
- Provider: PCCP pins 1.0.4 exactly and needs its own bump (check the ai 1.1.0 AssistantMessageEventStream change). Doug: no tight lockstep coordination needed this time.

Verify with tests during the bump
- 1.2.0 counts the session as busy from the start of run setup (isIdle false during before_agent_start; sendMessage queues into the starting run). Tattler queues to the pending inbox when !isIdle, and the cue uses triggerTurn only between agent_start and agent_settled. A message arriving during setup may sit in the pending inbox until the next turn. Write a test for this window.
- Chorus's ChorusRoomEditor.render post-processes CustomEditor lines; 1.2.0 wraps the drawn cursor in zero-width APC markers. The cursor isn't on the border line it edits, so it's probably fine; check live.

Others' code
- Birdup clock.ts and persona_latch.ts now inject their messages on wake turns too. Gate on event.messageType === "user" if unwanted (Doug's call).
- PCCP: prompt-routing guards with `if (!event?.prompt) return` (safe); rename detection uses agent_settled (safe). The 1.1.0 ai breaking change (stream functions must return AssistantMessageEventStream) needs checking on the PCCP side.
- reinforced-guidance: its before_agent_start uses only systemPromptOptions.contextFiles (safe). pi-yaams: safe under Sandpiper's contribution collector.

Can build on
- Program status (OSC 7501, 1.1.0): Pi reports working/blocked/done/failed to supporting terminals and dashboards (PI_PROGRAM_STATUS). Possibly replaces the mitsuhiko notify extension, and possibly useful for herdr.
- agent_settled.aborted (1.1.0): Tattler/Chorus can tell a cancelled run from a finished one.
- durationMs on tool_execution_end and the tool render context (1.1.0); outputPad on the tool render context (Sandpiper tool renderers don't apply it yet).
- Resumed sessions keep their active tools (1.3.0), and --tools +name/-name (1.1.0).
- reachesTools on tool definitions and namespace aliases (1.2.0), for the deferred-tools adoption candidate.
- Published $schema URLs for settings.json/models.json/keybindings/themes (1.2.0), for editor validation of Doug's settings.
- LoginOptions.agentName (ai 1.1.0): could brand the ChatGPT/Codex login as Sandpiper.

No impact
- Theme schema validation at startup (Sandpiper ships no themes; Doug uses built-in dark). Terminal.setProgramStatus is required, but Sandpiper implements no Terminal. The experimental server/client removal doesn't affect us (we don't use it). Provider/model catalog fixes.

Decisions (Doug, 2026-10-16)
- Birdup clock.ts and persona_latch.ts firing on wake turns: fine as is.
- Program status: use Pi's built-in OSC 7501 and remove the mitsuhiko notify extension from ~/.sandpiper/agent/settings.json packages once on 1.1.0+ (not before: 1.0.4 has no program status). Future work may build on it.
- agent_settled.aborted: possibly useful for PCCP; not a Sandpiper priority.
- Tool timing and padding, and theme colors: audit renderers for hardcoded padding and colors that should use outputPad and theme tokens.

Renderer audit, first pass (2026-10-16)
- Sandpiper: tool renderers in skill-loading-tool, web-fetch, tattler-receive, chorus, and turn-control (empty). Only tattler-inbox-renderer and chorus-ui apply outputPad. skill-loading-tool.ts:449 hardcodes bold (\x1b[1m … \x1b[22m) inside theme.fg instead of theme.bold. diagnostics-hooks.ts:55 uses a fixed Text padding of 1.
- PCCP (non-bundled): claude-cc-widget.ts:126-130 hardcodes raw ANSI green/yellow/red/faint for the usage bar (candidates: success/warning/error/dim theme tokens). claude-tool-renderers and the mirror renderer don't use outputPad.
- reinforced-guidance (non-bundled): fixed Text paddings in its panel; no raw colors.
- pi-yaams, Birdup pi-ext: nothing found.

---

# Activity Log

## 2026-10-16T16:16:01.759Z

- **description**: 1 line → updated (30 lines)

## 2026-10-16T16:30:24.403Z

- **description**: 30 lines → updated (42 lines)

## 2026-10-16T17:04:44.941Z

- **description**: 42 lines → updated (45 lines)

## 2026-10-16T17:04:57.509Z

- **status**: NOT STARTED → NEEDS REVIEW

## 2026-10-16T17:08:15.126Z

- **status**: NEEDS REVIEW → COMPLETE
- **resolution**: DONE
