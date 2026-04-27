---
title: "Tattler shutdown hangs pi exit: session_shutdown awaits an unbounded server.close() while peer connections linger"
status: COMPLETE
resolution: DONE
kind: BUG
priority: HIGH
assignee: "Fable"
reporter: USER
created_at: 2026-07-12T04:41:25.312Z
updated_at: 2026-07-13T04:15:24.948Z
---

# Tattler shutdown hangs pi exit: session_shutdown awaits an unbounded server.close() while peer connections linger

Diagnosed live 2026-07-11 (three simultaneous hangs; full forensics in pi-claude-code-cli-provider's PCCP-171): after the double-Ctrl+C exit gesture, every Tattler PARTICIPANT session hung at ~95% CPU while non-participants exited clean. The hung processes each held live connected UDS sockets at shutdown time.

Mechanism: extensions/tattler/index.ts session_shutdown awaits `new Promise(resolve => closingServer.close(() => resolve()))`. net.Server.close() only fires its callback after ALL accepted connections have fully closed — any lingering peer connection makes the await never settle, stalling pi's entire shutdown pipeline. The client side (sendPayloadFrame) already destroys its socket in a finally, so the lingering connections come from slower/edge paths (half-closed sockets awaiting peer FIN, partial frames keeping serverHandler's read loop alive, or peers that hung before closing).

Fix (this task): (1) track accepted sockets in createServerWithNotificationSender and expose a way to destroy them; (2) in session_shutdown, destroy tracked connections, then timebox the close await (withTimeout, already used in tattler-ipc) as a belt; unlink the socket path regardless. TDD: red test = server shutdown settles promptly while a client holds an open connection (partial frame, no newline).

Residual curiosity (not blocking): why bun BUSY-SPINS at ~95% on the close-pending server instead of parking — worth a bun --inspect if it recurs post-fix.

---

# Activity Log

## 2026-07-12T04:41:39.372Z

- **description**: added (7 lines)

## 2026-07-12T04:41:39.538Z

- **status**: NOT STARTED → IN PROGRESS
- **assignee**: UNASSIGNED → Fable

## 2026-07-12T04:44:41.418Z

- **status**: IN PROGRESS → NEEDS REVIEW

## 2026-07-13T04:15:24.952Z

- **status**: NEEDS REVIEW → COMPLETE
- **resolution**: DONE
