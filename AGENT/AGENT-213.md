---
title: "Prompt-contribution protocol: extensions register system-prompt blocks via event bus"
status: COMPLETE
resolution: DONE
kind: TASK
priority: HIGH
assignee: "Roux"
reporter: USER
created_at: 2026-06-09T22:44:32.784Z
updated_at: 2026-06-10T04:27:55.486Z
---

# Prompt-contribution protocol: extensions register system-prompt blocks via event bus

Prompt-contribution protocol so extension prompt blocks survive Sandpiper's whole-prompt rebuild without load-order coupling or prefix-cache busting.

CANONICAL CONTRACT (closed 2026-06-09, AGENT-214):
  channel: 'sandpiper:prompt-contribution'
  interface SandpiperPromptContribution { id; phase?: 'prepend'|'append'; acknowledge?: () => void; getContent: () => string|Promise<string|undefined>|undefined }
  - listener installed in session_start (sync enqueue only); contributors emit in resources_discover; collector resolves+freezes on first before_agent_start (prepend-before / append-after base prompt); unsubscribe on session_shutdown.
  - dedupe by trimmed id, first wins; collector calls acknowledge() synchronously only on accepted insert (not on dup); async work deferred to getContent.
  - acknowledge() = 'collector present' signal: emitter skips its own legacy direct-append fallback when acked; retains fallback for plain Pi / old Sandpiper.

LANES:
  AGENT-214 Huginn (sandpiper-ai collector) — DONE pending review; contract + acknowledge() + tests green.
  AGENT-215 Muninn (pi-yaams emitter) — aligning to canonical shape (channel, phase append, drop source, keep ack); re-verify.
  AGENT-216 Piper (docs) — tracks closed contract.

ACCEPTANCE (Roux): NOT done on per-side unit green alone. Requires END-TO-END proof — a live Sandpiper session with YAAMS_BOOTSTRAP_ENABLED=1 where the <memory> block actually lands in the final provider prompt (verify via YAAMS_BOOTSTRAP_DEBUG_FILE + dumpSystemPrompt/final-prompt dump), AND confirmation the legacy fallback does NOT also fire (no duplicate block) under Sandpiper. Prove the handshake across the real bus, not just the units.

---

# Activity Log

## 2026-06-09T22:45:15.327Z

- **status**: NOT STARTED → IN PROGRESS
- **assignee**: UNASSIGNED → Roux

## 2026-06-09T22:53:52.817Z

- **description**: 12 lines → updated (15 lines)

## 2026-06-09T22:57:03.366Z

- **status**: IN PROGRESS → NEEDS REVIEW

## 2026-06-10T04:27:55.487Z

- **status**: NEEDS REVIEW → COMPLETE
- **resolution**: DONE
