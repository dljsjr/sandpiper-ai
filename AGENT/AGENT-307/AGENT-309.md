---
title: "Redo the local Pi patch for 1.3.0 (tools/rules half only)"
status: COMPLETE
resolution: DONE
kind: SUBTASK
priority: MEDIUM
assignee: UNASSIGNED
reporter: AGENT
created_at: 2026-10-16T17:17:57.278Z
updated_at: 2026-10-19T17:27:17.890Z
---

# Redo the local Pi patch for 1.3.0 (tools/rules half only)

New patch patches/@earendil-works%2Fpi-coding-agent@1.3.0.patch carries only the system-prompt.js hunk (tools/rules under customPrompt). system-prompt.js is byte-identical between 1.0.4 and 1.3.0 (same git blob 83bf108 in both patch headers), so the hunk applied unchanged. Shape B (agent-session.js) dropped. No .bun-tag-* entries. Old 1.0.4 patch removed. Unpatched 1.3.0 failed exactly the 5 tools/rules tests; patched, all 14 prompt-ownership tests pass.

---

# Activity Log

## 2026-10-16T17:24:46.566Z

- **description**: added (1 line)

## 2026-10-16T17:27:41.150Z

- **status**: NOT STARTED → NEEDS REVIEW

## 2026-10-19T17:27:17.890Z

- **status**: NEEDS REVIEW → COMPLETE
- **resolution**: DONE
