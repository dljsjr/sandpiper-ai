---
title: "dumpSystemPrompt hangs in print mode: ctx.shutdown() is a silent no-op"
status: COMPLETE
resolution: DONE
kind: BUG
priority: MEDIUM
assignee: "sandpiper-0.84-dev"
reporter: "sandpiper-0.84-dev"
created_at: 2026-08-06T22:34:22.089Z
updated_at: 2026-08-06T22:51:00.419Z
---

# dumpSystemPrompt hangs in print mode: ctx.shutdown() is a silent no-op

DIAGNOSIS CORRECTION (2026-08-06, from implementation): the three originally-observed hangs were NOT the shutdown no-op manifesting - they were Pi's readPipedStdin() waiting for stdin EOF under the background-process tool's default stdin handling, and before that, model resolution ("No API key found") exiting before before_agent_start ever fired. Correct reproduction requires stdin from /dev/null plus any placeholder API key present. The shutdown no-op is nonetheless real and was verified directly under the corrected invocation: pre-fix the process reaches the dump path and hangs after printing; post-fix it exits 0. So the layered obstacles were: (1) stdin EOF, (2) API-key early exit, (3) the shutdown no-op this ticket fixes. Original root-cause text below stands for (3); (1)+(2) are Pi print-mode invocation requirements, not bugs.
SANDPIPER_DUMP_SYSTEM_PROMPT=1 hangs instead of exiting whenever pi runs in print mode. Root cause (source-verified by sandpiper-0.84-dev, 2026-08-06): extensions/system/startup-hooks.ts:76-78 calls ctx.shutdown() after dumping and assumes it exits. Pi's interactive mode wires a real shutdownHandler (dist/modes/interactive/interactive-mode.js ~1420), but print-mode.js never registers one, so ctx.shutdown() falls through to the extension runner's default no-op (runner.js:146) and execution continues into a real agent turn - silent hang.

Aggravating factor: pi's resolveAppMode() forces print mode whenever stdin/stdout is not a TTY, regardless of flags - so every headless/sandboxed/CI invocation hits this path unavoidably. Three hung invocations observed during AGENT-237 item (a); the dump feature is currently unusable outside a genuine interactive terminal.

Fix direction: make the dump path exit deterministically in both modes - e.g. call ctx.shutdown() (lets interactive cleanup run), then a short-fuse hard process.exit(0) fallback for the no-op case; or branch on ctx.mode. Constraint: the change must live entirely inside the dumpSystemPrompt branch (dormant unless the env var is set) so normal operation is untouched. Side benefit: makes the dump usable in scripted/CI contexts, which AGENT-237 item (a) needs for reproducible before/after prompt diffs (pre-bump side from a workspace at xulrqywv/b2bbf3e7).

---

---

# Activity Log

## 2026-08-06T22:37:26.664Z

- **status**: NOT STARTED → IN PROGRESS
- **assignee**: UNASSIGNED → sandpiper-0.84-dev

## 2026-08-06T22:43:43.280Z

- **status**: IN PROGRESS → NEEDS REVIEW

## 2026-08-06T22:43:43.340Z

- **status**: NEEDS REVIEW → COMPLETE
- **resolution**: DONE

## 2026-08-06T22:44:36.175Z

- **description**: 5 lines → updated (8 lines)

## 2026-08-06T22:45:00.888Z

- **status**: COMPLETE → NEEDS REVIEW

## 2026-08-06T22:51:00.420Z

- **status**: NEEDS REVIEW → COMPLETE
