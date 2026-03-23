---
title: "unbuffer-relay pipeline mode Ctrl+D does not reliably signal EOF"
status: NOT STARTED
kind: BUG
priority: LOW
assignee: UNASSIGNED
reporter: AGENT
created_at: 2026-03-23T05:18:28.806Z
updated_at: 2026-03-23T05:18:36.523Z
---

# unbuffer-relay pipeline mode Ctrl+D does not reliably signal EOF

In pipeline mode (-p), unbuffer-relay sends Ctrl+D (\x04) after writing stdin data to signal EOF to the child process. This does not reliably terminate commands like cat that wait for EOF — the PTY line discipline may treat the first Ctrl+D as a buffer flush rather than EOF when there is pending data. In practice this is not a problem because unbuffer-relay is used in a tee pipeline where the pipe provides natural EOF, but it means cat-based tests hang until timeout. Low priority since the real-world usage pattern is unaffected.

---

# Activity Log

## 2026-03-23T05:18:36.523Z

- **description**: added (1 line)
