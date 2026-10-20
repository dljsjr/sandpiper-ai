---
title: "Move Birdup's clock notification into Sandpiper"
status: COMPLETE
resolution: DONE
kind: TASK
priority: MEDIUM
assignee: AGENT
reporter: USER
created_at: 2026-11-18T21:59:02.054Z
updated_at: 2026-11-19T04:02:06.093Z
---

# Move Birdup's clock notification into Sandpiper

Birdup's src/birdup/pi-ext/clock.ts adds a hidden harness system notification with the current local time (and the time since the previous run) at the start of every agent run. Move it into Sandpiper so every session gets it, and remove it from Birdup (clock.ts, the --extension line in launch.py, and the launch tests). Improvements found while porting are run by Doug before they go in.

## Outcome (sandpiper nqlnkust, birdup vlyxvsul)

Sandpiper: `extensions/system/clock.ts`, loaded as the `clock` inline extension. At `before_agent_start` it adds a hidden custom message (`sandpiper:clock`) holding a bare `<clock currentTime="Wednesday, 2026-11-18 15:04:05 -06:00 (America/Chicago)" timeSinceLastMessage="2 h 3 min"/>`; the first run of a session has no `timeSinceLastMessage`. Fourth bullet in `system_notification_protocol.md`, worded by Doug: "`<clock>` elements are also hidden from the user. They help you measure the passage of time."

Agreed with Doug: Intl formatting instead of a `date` subprocess, IANA zone name; gap measured from the last message entry in the session branch (survives resume and /reload, excludes the previous run's duration); two-unit durations; no repeated label; one element with attributes, not wrapped in a system notification (inner text was 17 characters longer; dropping the wrapper saves 108 per run).

Birdup: clock.ts deleted, launch.py no longer passes it, launch tests updated; system-notification.ts kept for persona_latch.ts. Birdup is an editable uv tool install, so this is live on the next launch.

Checks: Sandpiper bun check clean, 92 files/852 tests, 13 prompt snapshots changed by exactly the bullet, dist rebuilt. Isolated RPC session against the mock provider: request 1 has the clock with no gap, request 2 has timeSinceLastMessage="2 s", both prompts have the bullet. Birdup: 23 unittest tests, tsc, biome, bun test, ruff all pass.

## Follow-up: previousTurnDuration (znoowkqx)

Doug's idea: report how long the previous run took. The clock times each run from `before_agent_start` until `agent_settled` (a run need not end with an assistant message, so the hooks measure it, not message timestamps) and saves `{ version: 1, durationMs }` as a `sandpiper:clock-run` custom entry with `appendEntry`. The next reading takes the latest entry from the branch: `previousTurnDuration="12 min 30 s"`. Survives reload and resume and follows the branch; unknown versions are ignored. Named for the model's sense of a turn (its whole reply), not Pi's per-request turn.

Known caveat, accepted: the duration includes time the run spent waiting, such as on ask_questions or fling_wait.

Checks: bun check clean, 92 files/856 tests (one unidentified failure in 1 of 5 full runs, not reproduced in the next 4, and the clock tests passed 15 of 15 focused runs), dist rebuilt. Isolated RPC E2E: after new_session and switch_session back, the resumed session's next request had previousTurnDuration from its saved entry; the new session in between had none.

---

# Activity Log

## 2026-11-18T21:59:02.171Z

- **status**: NOT STARTED → IN PROGRESS
- **assignee**: UNASSIGNED → AGENT

## 2026-11-18T22:18:05.743Z

- **description**: 1 line → updated (11 lines)

## 2026-11-18T22:18:05.814Z

- **status**: IN PROGRESS → NEEDS REVIEW

## 2026-11-19T03:31:17.779Z

- **description**: 11 lines → updated (19 lines)

## 2026-11-19T03:31:22.365Z

- **description**: updated

## 2026-11-19T04:02:06.094Z

- **status**: NEEDS REVIEW → COMPLETE
- **resolution**: DONE
