---
title: "Improve atomicity and data integrity for task operations"
status: IN PROGRESS
resolution: DONE
kind: TASK
priority: MEDIUM
assignee: AGENT
reporter: USER
created_at: 2026-03-23T03:18:38.835Z
updated_at: 2026-03-26T21:34:24.063Z
---

# Improve atomicity and data integrity for task operations

Improve atomicity and data integrity guarantees for task operations.

## Current Concerns

- Counter increment + file creation are not atomic (crash between them could leak a number)
- Index update after mutation is a separate step (index can be stale)
- Cross-project move with reference updates touches many files non-atomically
- No file locking — concurrent CLI invocations could produce inconsistent state

## Agent Thoughts (2026-03-25)

### Severity Assessment

Most of these issues are theoretical rather than practical:

**Low practical risk:**
- Counter gap on crash: a leaked number is cosmetically annoying but not data loss. The next create just gets the next number. No user has ever noticed a gap in JIRA ticket numbers.
- Concurrent CLI invocations: the sandpiper-tasks CLI is invoked by a single agent process. There's no multi-user scenario. The only race would be the user running the CLI manually while the agent is also running it — possible but rare.

**Medium practical risk:**
- Stale index: this is the most likely real problem. If a mutation succeeds but the index update fails (or the process dies between them), the index is stale. The existing `index rebuild` command fixes this, but the user has to know to run it.

**Higher practical risk:**
- Cross-project move: this is the multi-file operation with the most exposure. Moving a task involves creating the new file, deleting the old file, updating references in related tasks, and updating the index. A crash partway through could leave orphaned references or a task that exists in two places. In practice, moves are rare operations.

### Recommended Approach: Incremental, Not Big Bang

I'd recommend against a WAL/journaling system or flock-based locking — those add significant complexity for a tool that's fundamentally single-writer. Instead:

**1. Atomic file writes (cheap, high value)**
Replace all `writeFileSync(path, content)` with a write-to-temp-then-rename pattern:
```typescript
function atomicWriteSync(path: string, content: string): void {
  const tmp = path + '.tmp';
  writeFileSync(tmp, content);
  renameSync(tmp, path);
}
```
This is a one-line change per call site and guarantees that a crash mid-write never produces a partial file. `renameSync` is atomic on POSIX filesystems.

**2. Index self-healing (medium effort, high value)**
Instead of trusting the index blindly, add a lightweight consistency check that runs on CLI startup (or on first query):
- Compare index entry count vs actual task file count
- If mismatch, trigger automatic rebuild
- Log a warning so the user knows it happened

This makes index staleness self-correcting rather than requiring manual intervention.

**3. Move as two-phase operation (medium effort, medium value)**
For cross-project moves, write a ".pending-move" marker file before starting. If the CLI finds a pending-move marker on startup, it can resume/rollback the interrupted move. This is a lightweight form of journaling scoped specifically to the one operation that needs it.

**4. Skip file locking (not worth it)**
Advisory locks (flock) don't work across all platforms, add complexity, and don't protect against the actual failure modes (crash, not concurrency). The single-writer assumption is valid.

### Prioritized Implementation Order

1. Atomic file writes — smallest change, biggest safety improvement
2. Index self-healing — eliminates the most common real-world failure mode
3. Move journaling — only if move reliability becomes a practical issue
4. Skip file locking entirely

### Relationship to Index Spikes (TCL-55, TCL-61)

If we move to SQLite (TCL-55) or Wax (TCL-61) as the index backend, the index staleness problem may change shape entirely — those engines have their own atomicity guarantees. So it may be worth doing #1 (atomic writes) now and deferring #2/#3 until the index spike decisions are made.

---

# Activity Log

## 2026-03-23T03:19:16.438Z

- **description**: added (14 lines)

## 2026-03-26T04:38:47.831Z

- **description**: 14 lines → updated (64 lines)

## 2026-03-26T21:23:43.429Z

- **status**: NOT STARTED → IN PROGRESS
- **assignee**: UNASSIGNED → AGENT

## 2026-03-26T21:33:47.600Z

- **status**: IN PROGRESS → COMPLETE
- **resolution**: DONE

## 2026-03-26T21:34:24.064Z

- **status**: COMPLETE → IN PROGRESS
