---
title: "Review mailbox-based multi-agent coordination architecture"
status: COMPLETE
resolution: DONE
kind: TASK
priority: HIGH
assignee: AGENT
reporter: USER
created_at: 2026-05-14T15:12:36.104Z
updated_at: 2026-11-23T22:02:51.435Z
---

# Review mailbox-based multi-agent coordination architecture

Architecture review complete. All five key changes have accepted decisions. Outputs fed directly into TAT-6 through TAT-9:

- Key Change 1: Use existing system notification envelope + Pi sendMessage (accepted)
- Key Change 2: Peer-first ephemeral DMs as MVP, not durable team coordination (accepted with reframing)
- Key Change 3: Push wake-up with triggerTurn for online recipients only; no broadcast/coalescing in MVP (revised and accepted)
- Same-host IPC reframe: claims/<agentId>.claim + sockets/<short-agentId>.sock with flock for liveness (accepted with revisions)
- Key Change 5: Minimal live DM payloads — id, from, message only (accepted with revisions)

Full notes at .sandpiper/archive/mailbox-coordination-architecture-notes.md.
Refs: TAT-6, TAT-7, TAT-8, TAT-9

---

# Activity Log

## 2026-05-14T15:13:45.493Z

- **status**: NOT STARTED → IN PROGRESS
- **assignee**: UNASSIGNED → AGENT

## 2026-05-14T15:18:02.639Z

- **description**: added (1 line)

## 2026-05-21T04:13:12.120Z

- **description**: 1 line → updated (10 lines)

## 2026-05-21T04:13:12.176Z

- **status**: IN PROGRESS → NEEDS REVIEW

## 2026-05-21T04:13:12.233Z

- **status**: NEEDS REVIEW → COMPLETE
- **resolution**: DONE

## 2026-11-23T22:02:51.435Z

- **description**: updated
