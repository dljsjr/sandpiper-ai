---
title: "Author multi-agent room coordination & decision-ownership playbook"
status: COMPLETE
resolution: DONE
kind: TASK
priority: MEDIUM
assignee: "Piper"
reporter: USER
created_at: 2026-05-25T21:52:33.225Z
updated_at: 2026-05-27T03:20:28.849Z
related:
  - TAT-33
  - TAT-38
  - TAT-64
---

# Author multi-agent room coordination & decision-ownership playbook

Delivered: the multi-agent room coordination playbook at ~/.sandpiper/agent/playbooks/workflow/multi-agent-rooms.md (wired into workflow/index.md). It defines how multiple agents coordinate in a Chorus room: start from the work graph not roles; map lanes/shared-state/isolation/artifacts before assigning agents; prefer jj-workspace isolation for coding lanes and artifact isolation for non-code; assign Owner/Lens/Scribe per phase; heartbeats over courtesy ACKs; chat-phase discipline (batch-read, classify, claim, act); and honest harness-limit mitigations (pre-assignment over reactive claiming, shared-state-as-lock, human as serialization point). Dogfooded live 2026-05-26 in room 'the gang writes some code' during the durable-rooms sizing pass: the pre-assignment and one-owner/no-parallel-synthesis sections validated in real time. SCOPE SPLIT: this ticket originally also implied a code-level protocol in the sandpiper-chorus integration; that implementation is split to a new follow-on ticket and deferred until the durable-rooms v1 rebuild lands, so it targets the new room substrate. This ticket covers the delivered playbook/guidelines only.

---

# Activity Log

## 2026-05-26T03:09:32.267Z

- **status**: NOT STARTED → IN PROGRESS
- **assignee**: UNASSIGNED → Piper

## 2026-05-26T03:09:32.339Z

- **description**: updated

## 2026-05-26T03:10:10.381Z

- **description**: updated

## 2026-05-26T03:10:53.379Z

- **description**: updated

## 2026-05-26T03:30:24.067Z

- **description**: updated

## 2026-05-27T03:13:26.809Z

- **status**: IN PROGRESS → NEEDS REVIEW

## 2026-05-27T03:20:28.782Z

- **title**: Design multi-agent delegation and decision ownership protocol → Author multi-agent room coordination & decision-ownership playbook
- **description**: updated

## 2026-05-27T03:20:28.850Z

- **status**: NEEDS REVIEW → COMPLETE
- **resolution**: DONE
