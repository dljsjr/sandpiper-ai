---
title: "Harden Tattler sending and serving against edge cases found by claude-tattler"
status: COMPLETE
resolution: DONE
kind: TASK
priority: LOW
assignee: AGENT
reporter: AGENT
created_at: 2026-11-20T15:27:07.754Z
updated_at: 2026-11-23T22:02:48.163Z
---

# Harden Tattler sending and serving against edge cases found by claude-tattler

From the 2026-11-20 comparison (candidates 3, 5, 6, 8): refuse an empty message and an encoded frame over the 6144-byte request limit before connecting (a 4096-byte message of quotes or newlines escapes past it and gets an uncorrelated error); a server idle read timeout (a silent client holds a connection forever); probeSocket should destroy() rather than end(); keep error replies under 2048 bytes; consider a watch that rewrites a missing identity file and rebinds when the socket file is swept (a long-suspended peer can look refused). Evidence: the claude-tattler repository (https://github.com/dljsjr/claude-tattler), its robustness and interop tests.

Outcome (xsxzqpol): empty/oversize message and >6144-byte encoded frame refused before peer lookup; 10 s server idle timeout; error texts cut to 400 chars; probeSocket destroys; 1 s watch rewrites a missing identity file and rebinds a swept socket (closing the old server first, since closing can unlink the path). Half-close reply already worked; test pins it. bun check clean, 93 files/883 tests, dist rebuilt.

---

# Activity Log

## 2026-11-20T15:37:12.336Z

- **status**: NOT STARTED → IN PROGRESS
- **assignee**: UNASSIGNED → AGENT

## 2026-11-20T15:47:22.000Z

- **status**: IN PROGRESS → NEEDS REVIEW
- **description**: 1 line → updated (3 lines)

## 2026-11-20T16:02:31.404Z

- **status**: NEEDS REVIEW → COMPLETE
- **resolution**: UNRESOLVED → DONE

## 2026-11-23T22:02:48.163Z

- **description**: updated
