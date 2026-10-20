---
title: "Remove bundled standup runtime and wire stable Journal directory defaults"
status: COMPLETE
resolution: DONE
kind: SUBTASK
priority: MEDIUM
assignee: "cutover-dev"
reporter: AGENT
created_at: 2026-10-27T22:15:03.927Z
updated_at: 2026-10-27T23:52:36.456Z
---

# Remove bundled standup runtime and wire stable Journal directory defaults

Removed packages/sandpiper-standup-cli, bundled standup skill/helper, helper sync and build/test/lock/knip wiring. Kept generic session lifecycle/PID infrastructure. Shared configurePiEnvironment now defaults AGENT_JOURNAL_DIR to absolute launch cwd/.sandpiper only when undefined, before imports in both entrypoints. Empty/relative/absolute values preserved exactly. Test-first: recorded failing default, then 14 bootstrap tests and staging test passed. Staging rejects orphan skill directories left by upgrades, retaining valid nested assets. Both actual built entrypoints + changed-cwd child passed 8 absent/override cases with fake HOME/agent dirs. Runtime slice independently reviewed. Final bun check clean; full gate 87files/640tests passes in developer and reviewer workspaces. Evidence: launch-env-after.json, runtime-red.txt, cache-hermetic-check.txt, hermetic-final-test.txt under /private/tmp/journal-cutover-jt1zotyw.

---

# Activity Log

## 2026-10-27T22:59:26.942Z

- **status**: NOT STARTED → IN PROGRESS
- **assignee**: UNASSIGNED → cutover-dev

## 2026-10-27T23:00:53.879Z

- **description**: added (1 line)

## 2026-10-27T23:34:53.185Z

- **description**: updated

## 2026-10-27T23:36:18.431Z

- **status**: IN PROGRESS → NEEDS REVIEW

## 2026-10-27T23:52:36.457Z

- **status**: NEEDS REVIEW → COMPLETE
- **resolution**: DONE
