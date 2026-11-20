---
title: "Harden Tattler sending and serving against edge cases found by claude-tattler"
status: NOT STARTED
kind: TASK
priority: LOW
assignee: UNASSIGNED
reporter: AGENT
created_at: 2026-11-20T15:27:07.754Z
updated_at: 2026-11-20T15:27:07.754Z
---

# Harden Tattler sending and serving against edge cases found by claude-tattler

From the 2026-11-20 comparison (candidates 3, 5, 6, 8): refuse an empty message and an encoded frame over the 6144-byte request limit before connecting (a 4096-byte message of quotes or newlines escapes past it and gets an uncorrelated error); a server idle read timeout (a silent client holds a connection forever); probeSocket should destroy() rather than end(); keep error replies under 2048 bytes; consider a watch that rewrites a missing identity file and rebinds when the socket file is swept (a long-suspended peer can look refused). Evidence: ~/git/claude-tattler test/helper/robustness.spec.ts, interop.spec.ts.
