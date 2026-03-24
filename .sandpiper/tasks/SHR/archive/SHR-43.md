---
title: "FIFO tests leak open streams, hanging vitest when running multiple test files"
status: COMPLETE
resolution: DONE
kind: BUG
priority: HIGH
assignee: AGENT
reporter: AGENT
created_at: 2026-03-23T03:31:17.041Z
related:
  - SHR-32
updated_at: 2026-03-23T03:57:42.874Z
---

# FIFO tests leak open streams, hanging vitest when running multiple test files

The O_RDWR sentinel pattern tests in fifo.test.ts create `createReadStream` instances directly in test bodies but don't always destroy them, AND there was an infinite loop bug in signal.ts.

**Bug 1 (FIFO stream leak):** Tests create read streams that keep the event loop alive. Fixed by tracking streams and destroying with await in afterEach.

**Bug 2 (signal.ts infinite loop — PRIMARY):** The `feed()` method's while loop had a `continue` statement for empty lines that skipped the `newlineIndex` re-assignment at the bottom of the loop. When processing buffers with consecutive newlines (e.g., `\\n\\nprompt_ready\\n\\n`), the stale `newlineIndex` caused an infinite loop at 100% CPU.

**Root cause of Bug 2:** A biome autofix restructured the original `while ((newlineIndex = buffer.indexOf('\\n')) !== -1)` assignment-in-condition loop into separate init + while + reassign-at-bottom. The `continue` for empty lines bypassed the reassignment. The existing test for empty lines (`should ignore empty lines`) passed because the test input `\\n\\nprompt_ready\\n\\n` only triggered the infinite loop when the FULL signal.test.ts suite ran (vitest worker thread stayed alive spinning).

**Fix:** Added `newlineIndex = this.buffer.indexOf('\\n')` before the `continue` in the empty-line branch. Also fixed FIFO test stream cleanup with tracked streams and awaited close.

---

# Activity Log

## 2026-03-23T03:31:28.073Z

- **description**: added (10 lines)
- **related**: (none) → SHR-32

## 2026-03-23T03:31:28.104Z

- **status**: NOT STARTED → IN PROGRESS
- **assignee**: UNASSIGNED → AGENT

## 2026-03-23T03:57:42.843Z

- **description**: 10 lines → updated (9 lines)

## 2026-03-23T03:57:42.874Z

- **status**: IN PROGRESS → COMPLETE
- **resolution**: DONE
