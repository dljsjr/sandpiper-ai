---
title: "Headless CLI integration-test pathway (second validation lane)"
status: COMPLETE
resolution: DONE
kind: TASK
priority: HIGH
assignee: "sandpiper-0.84-dev"
reporter: USER
created_at: 2026-08-07T14:57:16.486Z
updated_at: 2026-11-23T22:02:40.647Z
---

# Headless CLI integration-test pathway (second validation lane)

All four subtasks complete and reviewer-approved: AGENT-250 (design), AGENT-251 (harness foundation), AGENT-252 (mock provider + scripting, and a network-deny-guard mechanism that was built, corrected twice for real gaps, then torn down entirely once the actual root cause of the incident that motivated it was found to be a self-inflicted config-isolation gap rather than an ambient-credential leak), AGENT-253 (wave-1 coverage: skill + autotoon isolated/combinatoric, rpc-driver line-buffering unit coverage, and the AGENT-237(e) compaction/steer payoff hypothesis validated headlessly).

Delivered at devtools/integration/: prepareIsolatedSpawn() (isolation-by-construction spawn helper, two entry modes -- raw pi and the sandpiper wrapper), print-mode and RPC drivers, a scriptable mock provider (multi-turn, tool calls, deterministic stop reasons), and the config-isolation containment canary that directly proves the fix for the original incident.

Explicitly NOT covered, named as scope rather than left as silent debt: the compiled-binary variant of entry:'sandpiper' (evaluated for wave 1, not cheap to build in this environment, deferred as named wave-2 scope per the coordinator's ruling); tattler (two-process harness capability needed, deferred to wave 2 by AGENT-250's own design); background-process, shell-relay, web-fetch/web-search live paths (deferred with their own stated reasons in the design doc's wave-1 scope section).

Full postmortem lives in .sandpiper/archive/agent-249-headless-cli-integration-harness-design.md, with the corrected root cause and the guard's build-then-teardown arc recorded so it isn't rebuilt from scratch.

---

# Activity Log

## 2026-08-07T16:04:53.589Z

- **description**: 10 lines → updated (12 lines)

## 2026-08-07T18:33:39.759Z

- **status**: NOT STARTED → IN PROGRESS
- **assignee**: UNASSIGNED → sandpiper-0.84-dev

## 2026-08-07T18:33:56.558Z

- **description**: 12 lines → updated (7 lines)

## 2026-08-07T18:34:02.720Z

- **status**: IN PROGRESS → NEEDS REVIEW

## 2026-08-07T18:34:02.781Z

- **status**: NEEDS REVIEW → COMPLETE
- **resolution**: DONE

## 2026-11-23T22:02:40.647Z

- **description**: updated
