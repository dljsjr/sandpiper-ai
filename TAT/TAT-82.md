---
title: "Mid-turn Tattler pending-inbox cue never reaches the model"
status: COMPLETE
resolution: DONE
kind: BUG
priority: HIGH
assignee: AGENT
reporter: "pi-claude-code-cli-agent"
created_at: 2026-10-06T12:29:08.478Z
updated_at: 2026-10-06T15:47:02.387Z
related:
  - AGENT-290
---

# Mid-turn Tattler pending-inbox cue never reaches the model

extensions/tattler/tattler-pending-cue.ts sends the pending-inbox cue with deliverAs steer and triggerTurn: false. Pi 0.84.0's sendCustomMessage steered any custom message into the running loop while streaming. Since Pi 0.84.2 (pi #8022, commit 47b5119d0, 'trigger turn false should not start turn'), triggerTurn: false while streaming queues the message in _pendingCustomMessages and appends it after the turn. The running loop keeps its context snapshot, so the model does not see the cue until a later run and cannot choose to call tattler_receive. Pi 1.0.3 behaves the same.

Evidence (reported by the pi-claude-code-cli-provider agent, verified against Pi source v0.84.0 vs v0.84.2): Aug 6-7 sessions on Pi 0.84.0, 13 of 13 cues followed by tattler_receive; 2026-10-06 on Pi 0.85.1, 0 of 2, and the cues never reached the provider request. Sandpiper crossed 0.84.2 in 'bump deps' (2026-09-08). Under pi-claude-code-cli-provider the deferred cue is lost entirely (PCCP-side issue tracked there).

Fix direction: send the cue with triggerTurn true while the agent is streaming, which routes to agent.steer. The cue is only sent while the agent is busy, but busy is not always streaming (for example compaction or retry backoff). In that window triggerTurn true would start a run, so the fix must check streaming state rather than rely on isIdle. Add a regression test that asserts the cue is steered into a running loop.

---

# Activity Log

## 2026-10-06T12:34:44.459Z

- **status**: NOT STARTED → IN PROGRESS
- **assignee**: UNASSIGNED → AGENT

## 2026-10-06T12:38:10.926Z

- **status**: IN PROGRESS → NEEDS REVIEW

## 2026-10-06T15:47:02.388Z

- **status**: NEEDS REVIEW → COMPLETE
- **resolution**: DONE
