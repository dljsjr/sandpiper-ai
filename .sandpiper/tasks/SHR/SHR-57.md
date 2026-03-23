---
title: "Spawn ghost Zellij client via expect for reliable write-chars and dump-screen"
status: COMPLETE
resolution: DONE
kind: TASK
priority: HIGH
assignee: AGENT
reporter: USER
created_at: 2026-03-23T06:37:12.228Z
updated_at: 2026-03-23T06:45:18.134Z
---

# Spawn ghost Zellij client via expect for reliable write-chars and dump-screen

Use expect to spawn a ghost Zellij client as a detached child process. This gives Zellij a real client with a PTY, making write-chars and dump-screen work reliably (both fail silently on background sessions without a client).

The ghost client should be used in ALL session flows:
- Auto-creating a new session (replaces --create-background)
- Connecting to a user-specified existing session

Implementation:
1. Write a small expect script (ghost-attach.exp or similar) that spawns zellij attach --create <session> and waits forever
2. In the extension, spawn this script as a detached child process (child_process.spawn with detached: true, unref())
3. Wait briefly for the client to attach (verify with dump-screen or list-clients)
4. Then inject env vars and proceed with normal setup
5. Kill the ghost client on session_shutdown

This restores auto-create capability and makes the relay work even when the user hasn't attached to the session yet.

---

# Activity Log

## 2026-03-23T06:37:22.585Z

- **description**: added (14 lines)

## 2026-03-23T06:37:27.171Z

- **status**: NOT STARTED → IN PROGRESS
- **assignee**: UNASSIGNED → AGENT

## 2026-03-23T06:45:18.135Z

- **status**: IN PROGRESS → COMPLETE
- **resolution**: DONE
