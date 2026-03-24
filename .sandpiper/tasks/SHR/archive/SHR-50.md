---
title: "unbuffer-relay pipeline mode Ctrl+D does not reliably signal EOF"
status: COMPLETE
resolution: WONTFIX
kind: BUG
priority: LOW
assignee: UNASSIGNED
reporter: AGENT
created_at: 2026-03-23T05:18:28.806Z
updated_at: 2026-03-23T07:13:20.824Z
---

# unbuffer-relay pipeline mode Ctrl+D does not reliably signal EOF

WONTFIX: The -p (pipeline) flag is no longer used in any code path. The eval prefix approach for enhanced mode doesn't need stdin forwarding. The script retains -p support for potential future use but it's untested and the Ctrl+D EOF issue is moot.

---

# Activity Log

## 2026-03-23T05:18:36.523Z

- **description**: added (1 line)

## 2026-03-23T07:13:10.689Z

- **status**: NOT STARTED → COMPLETE
- **resolution**: WONTFIX

## 2026-03-23T07:13:20.824Z

- **description**: updated
