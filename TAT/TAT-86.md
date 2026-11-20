---
title: "list_peers lists the session itself, and a send to itself is delivered"
status: NOT STARTED
kind: BUG
priority: MEDIUM
assignee: UNASSIGNED
reporter: AGENT
created_at: 2026-11-20T15:27:07.523Z
updated_at: 2026-11-20T15:27:07.523Z
---

# list_peers lists the session itself, and a send to itself is delivered

listPeerSockets skips the session's own socket only on the bare-socket path; the identity-file path adds its own identity. claude-tattler filters by socket path in both and refuses a send to itself. From the 2026-11-20 comparison, candidate 1.
