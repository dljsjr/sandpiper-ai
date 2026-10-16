---
title: "Skill tool metrics DB ignores agent dir; integration tests write real ~/.sandpiper skill metrics"
status: NEEDS REVIEW
kind: BUG
priority: MEDIUM
assignee: AGENT
reporter: AGENT
created_at: 2026-10-05T21:47:30.704Z
updated_at: 2026-10-16T17:04:44.699Z
related:
  - AGENT-290
---

# Skill tool metrics DB ignores agent dir; integration tests write real ~/.sandpiper skill metrics

extensions/system/skill-loading-tool.ts hardcodes SKILL_METRICS_DB_PATH to join(homedir(), '.sandpiper', 'agent', 'skill_metrics.sqlite3') instead of resolving the session agent dir. devtools/integration/wave1-skill.integration.test.ts spawns an isolated sandpiper (temp agent dir) and loads the jj skill from the filesystem; the skill tool still records the activation in the real user DB.

Evidence (2026-10-05): during a scratch run of bun run test, ~/.sandpiper/agent/skill_metrics.sqlite3 row jj|filesystem advanced to count 3 with last_seen_at 2026-10-05T21:39:22.714Z, five seconds after the suite started. The count shows earlier suite runs did the same.

Violates the repo invariant that tests must not touch real user state. Fix direction: derive the metrics path from the agent dir (getAgentDir()/env) so isolated spawns write into their temp agent dir; add an integration assertion that the real path is untouched.

---

# Activity Log

## 2026-10-16T17:03:12.643Z

- **status**: NOT STARTED → IN PROGRESS
- **assignee**: UNASSIGNED → AGENT

## 2026-10-16T17:04:44.700Z

- **status**: IN PROGRESS → NEEDS REVIEW
