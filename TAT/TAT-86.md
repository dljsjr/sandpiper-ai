---
title: "list_peers lists the session itself, and a send to itself is delivered"
status: COMPLETE
resolution: DONE
kind: BUG
priority: MEDIUM
assignee: AGENT
reporter: AGENT
created_at: 2026-11-20T15:27:07.523Z
updated_at: 2026-11-20T16:02:31.404Z
---

# list_peers lists the session itself, and a send to itself is delivered

listPeerSockets skips the session's own socket only on the bare-socket path; the identity-file path adds its own identity. claude-tattler filters by socket path in both and refuses a send to itself. From the 2026-11-20 comparison, candidate 1.

Outcome (yzworynq): listPeerSockets filters identity files by socket path too; a send to itself gets "No live peer with id". list_peers prints "This session: <name> [shortId: <id>]" first. bun check clean, 93 files/883 tests, dist rebuilt.

---

# Activity Log

## 2026-11-20T15:37:12.336Z

- **status**: NOT STARTED → IN PROGRESS
- **assignee**: UNASSIGNED → AGENT

## 2026-11-20T15:47:21.612Z

- **status**: IN PROGRESS → NEEDS REVIEW
- **description**: 1 line → updated (3 lines)

## 2026-11-20T16:02:31.404Z

- **status**: NEEDS REVIEW → COMPLETE
- **resolution**: UNRESOLVED → DONE
