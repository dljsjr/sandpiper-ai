---
title: "Inline fish string escaping to eliminate subprocess latency"
status: COMPLETE
resolution: WONTFIX
kind: TASK
priority: HIGH
assignee: AGENT
reporter: USER
created_at: 2026-03-23T04:07:51.689Z
updated_at: 2026-03-23T04:14:33.332Z
---

# Inline fish string escaping to eliminate subprocess latency

Inline fish string escaping to eliminate subprocess latency.

**Status: Reverted.** The initial implementation ported fish's escape_string_script() from Rust to TypeScript, which produced a GPL-derived work (fish is GPLv2). This is incompatible with our MIT licensing goal.

**Options going forward:**
1. Keep the subprocess approach (~400ms per command) — simple, correct, no license issues
2. Write a clean-room implementation based on observed behavior (not source code) — requires someone who hasn't read the fish source to implement it
3. Find a permissively-licensed library — shescape was evaluated but lacks fish support

**Current decision:** Keep subprocess. The latency is per-command, not per-keystroke, so it's acceptable for interactive agent use. If it becomes a bottleneck, option 2 is the path forward.

**Resolution: WONTFIX** — subprocess approach is acceptable for now.

---

# Activity Log

## 2026-03-23T04:07:51.725Z

- **status**: NOT STARTED → IN PROGRESS
- **assignee**: UNASSIGNED → AGENT

## 2026-03-23T04:11:53.524Z

- **status**: IN PROGRESS → COMPLETE
- **resolution**: DONE

## 2026-03-23T04:14:33.303Z

- **description**: added (12 lines)

## 2026-03-23T04:14:33.332Z

- **resolution**: DONE → WONTFIX
