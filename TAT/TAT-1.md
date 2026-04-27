---
title: "Implement Tattler v0 validation spike"
status: COMPLETE
resolution: DONE
kind: TASK
priority: HIGH
assignee: USER
reporter: USER
created_at: 2026-05-15T03:13:00.988Z
updated_at: 2026-07-11T16:53:29.547Z
---

# Implement Tattler v0 validation spike

Build the smallest useful control.ts-style validation slice for live agent-to-agent messaging.

Scope:
- UDS stream socket per live session/process.
- NDJSON framing.
- Pre-contract tattler.agent-message.v0 frame with from + message.
- Agent-facing list/send tools.
- Compact system-notification delivery to the recipient.

Non-goals for this spike: stable agent UUIDs, handles, agent directory, claim/flock ownership, handshakes, ack/error correlation, JSON Schema distribution, durable logs, and broadcast channels.

Acceptance:
- Two live Sandpiper sessions can discover each other and exchange terse messages.
- Recipient sees compact injected prose, not raw transport metadata.
- Findings are recorded before promoting v0 shortcuts into any MVP contract.

---

# Activity Log

## 2026-05-18T17:48:57.278Z

- **status**: NOT STARTED → IN PROGRESS
- **assignee**: UNASSIGNED → AGENT

## 2026-05-18T17:49:15.245Z

- **assignee**: AGENT → USER

## 2026-07-01T03:43:13.125Z

- **status**: IN PROGRESS → NEEDS REVIEW

## 2026-07-11T16:53:29.547Z

- **status**: NEEDS REVIEW → COMPLETE
- **resolution**: DONE
