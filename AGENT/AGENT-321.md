---
title: "System prompt changes mid-session when jj colocation detection times out"
status: COMPLETE
resolution: DONE
kind: BUG
priority: HIGH
assignee: AGENT
reporter: AGENT
created_at: 2026-11-10T22:33:19.263Z
updated_at: 2026-11-23T22:05:41.762Z
related:
  - TOOLS-92
---

# System prompt changes mid-session when jj colocation detection times out

## Corrected hermetic full gate passed (2026-11-11)

With the approved mwqvznwo smoke guard inherited, independent frozen install, zero-warning check and unfiltered full suite passed: 70 files/559 tests. Actual offline/read-only packed CLI checks included. Exact command: bun run test --maxWorkers 1 --no-file-parallelism. No timeout changes or retries. Status NEEDS REVIEW, not accepted.

## Full verification passed (2026-11-11)

xykrywto: independent frozen install, zero-warning bun check, and full `bun run test --maxWorkers 1 --no-file-parallelism` passed: 70 files / 559 tests. No filters, exclusions or timeout changes; real offline/read-only packed CLI checks included. Fresh start load was below8. Independent code review found no outstanding actionable findings. Status is NEEDS REVIEW, not user-accepted COMPLETE. Earlier implementation checkpoints below preceded this full gate.

## Independent check checkpoint (2026-11-11)

Parent/gate independently passed frozen install and the revision-specific bun check with zero errors/warnings. All ten tasks are implemented and independently reviewed with no outstanding actionable findings. Full/per-commit full-test gates remain pending quiet load; no completion or acceptance is claimed.

## Implementation checkpoint (2026-11-11)

Change xykrywto caches VCS, USER.md and identity input per session, resets the detector baseline, and still renders current Pi options. Worker reproduced the three unstable-input failures and baseline reset, then passed 155 focused tests and 13 non-dump real-Pi cases. Independent review found no actionable issue. Full/per-commit quiet-machine gates are pending.

Status remains IN PROGRESS. This checkpoint is not verified completion or user acceptance.

## Decision (Doug, 2026-11-11)

Detect once per session and reuse the result. Apply this to everything Sandpiper reads for the system prompt, not only version control. Not started.

## What feeds Sandpiper's part of the prompt

The prompt is rebuilt on every agent run (extensions/system/startup-hooks.ts, before_agent_start).

Read again on every run, so it can change mid-session:
- Version-control detection, including the jj colocation command (packages/core/src/version-control.ts). This is the observed cause.
- USER.md in the agent directory (packages/core/src/user-profile.ts). An edit takes effect at the next run.
- The --identity flag when its value is a file path (startup-hooks.ts, buildEffectiveSystemPrompt). birdup passes text, not a path.

Already fixed per session:
- The session start date, stored as a session entry.
- Prompt contributions from other extensions, resolved once and reset at session_start.
- Package paths, the Pi version and the platform, fixed per process.

Supplied by Pi on each run, changed only by Pi:
- Context files (AGENTS.md) and the skill list. Pi loads them at startup and on /reload (dist/core/agent-session.js, _rebuildSystemPrompt).
- The selected tools, which change one sentence of the skills block when the skill tool is toggled.
- The appended prompt.

Outside Sandpiper's block: Pi's own tools and rules sections change when the active tools change. That is by design.

## Evidence from one session

In the TOOLS-92 review session the prompt changed four times after the rebuild on 2026-11-10. Every change was the colocated_git attribute appearing or disappearing. Nothing else changed. Each change also made the Claude Code CLI provider resend about 28 KB of prompt into the conversation.

## Approved shape (Doug, 2026-11-11)

Doug confirmed that USER.md and the identity file are frozen per session too. An edit to either takes effect on /reload or in a new session, not on the next message.

Cache the three inputs Sandpiper reads itself (version control, USER.md, the identity file) at the first build of a session, and keep building the prompt text from the cached inputs plus Pi's options. Refresh the cache at session_start, which fires for startup, reload, new, resume and fork. The failing test first: two builds in one session give identical text when the command result, USER.md or the identity file differs between them.

Related: the prompt-change detector compares against the first prompt of the process, not of the session (inventory row B-22, agent evidence). Check it while fixing this.

## Symptom

The system prompt changes in the middle of a session. Each change makes Sandpiper write a file named <timestamp>-CHANGED-SYSPROMPT.diff into the home directory and show a warning. 38 such files exist on Doug's machine on 2026-11-10: 9 from October and 29 from November. Two were written at 16:28 on 2026-11-10, after the rebuild onto Pi 1.5.2.

The three diffs inspected all change one line:

    -  <version_control system="jj" colocated_git="true" detection="session_start"/>
    +  <version_control system="jj" detection="session_start"/>

or the reverse. A changed system prompt also invalidates the provider's prompt cache for that request.

## Cause

The prompt is rebuilt on every before_agent_start (extensions/system/startup-hooks.ts:174-176). The rebuild calls detectVersionControl (packages/core/src/startup-prompt.ts:59), which runs "jj git colocation status" through execFileSync with a 1000 ms timeout (packages/core/src/version-control.ts:28-48). When the command times out or fails, detectJjColocation returns undefined and the colocated_git attribute is left out.

Measured on 2026-11-10 with the machine under load (load average 73): the command took 0.35 s to 0.66 s. Under heavier load it passes the 1 s limit.

The attribute says detection="session_start", but detection runs on every turn. The session start date is cached per session (getOrCreateSessionStartDate); the version-control result is not.

Second effect: execFileSync blocks the event loop for the length of the jj call on every turn.

## Options

1. Detect once per session and reuse the result, as the attribute name already promises.
2. Drop colocation detection. Report system="jj" from the .jj directory alone, which needs no subprocess. This removes about 20 lines and the per-turn spawn.

Either option needs a test that fails first: two prompt builds in one session must produce identical version_control output when the command result differs between them.

Found during the TOOLS-92 review. Related inventory rows: K-14e (version-control detection) and the CHANGED-SYSPROMPT detector, which is what made this visible.

---

# Activity Log

## 2026-11-11T16:31:50.225Z

- **description**: 29 lines → updated (64 lines)

## 2026-11-11T16:34:02.228Z

- **description**: 64 lines → updated (66 lines)

## 2026-11-11T17:03:39.263Z

- **status**: NOT STARTED → IN PROGRESS
- **assignee**: UNASSIGNED → AGENT

## 2026-11-11T17:32:16.193Z

- **description**: 66 lines → updated (72 lines)

## 2026-11-11T17:58:19.676Z

- **description**: 72 lines → updated (76 lines)

## 2026-11-11T18:14:48.151Z

- **status**: IN PROGRESS → NEEDS REVIEW

## 2026-11-11T18:15:16.738Z

- **description**: 76 lines → updated (80 lines)

## 2026-11-11T19:21:12.118Z

- **description**: 80 lines → updated (84 lines)

## 2026-11-11T21:54:01.388Z

- **status**: NEEDS REVIEW → COMPLETE
- **resolution**: DONE

## 2026-11-23T22:05:41.762Z

- **description**: updated
