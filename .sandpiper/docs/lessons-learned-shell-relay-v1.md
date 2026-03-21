# Lessons Learned — Shell Relay v1 Implementation

Captured during the initial PRD review and implementation session (2026-03-20 through 2026-03-21).

## PRD Review Process

### What worked well
- **Collaborative top-to-bottom review** with alternating questions from both sides surfaced design issues early (e.g., the bidirectional collaboration model, the `tee` wrapper problems, the signal channel approach)
- **Updating the PRD in real-time** during discussion prevented "stale doc" syndrome
- **Deduplication sweeps** after major edits caught inconsistencies between the approach section and FRs
- **Separating the work plan** into its own document made both docs easier to maintain independently
- **Resolving open questions** before starting implementation avoided mid-implementation design debates

### What to improve
- The initial PRD was written before the primary value proposition was clear ("shared terminal" vs "auth fix"). Starting with the user-facing value proposition first would have avoided a major rewrite.
- The approach section went through three architectures (UDS → dump-screen → dual FIFO). Each pivot required updating multiple sections. A lighter approach section that defers to FRs earlier would reduce churn.

## Architecture Decisions

### The `tee` wrapper came back, but differently
We initially rejected `tee` wrappers due to quoting complexity, then tried `dump-screen` only, then came back to `tee` with a key insight: the **wrapper function is defined in the shell integration script**, not constructed inline by the extension. The extension just calls `__relay_run ESCAPED_COMMAND`. This sidesteps most of the quoting nightmare.

### Fish `string escape --style=script` is the escaping solution
Instead of reimplementing shell escaping rules in TypeScript, we delegate to fish's own `string escape` via stdin. This guarantees correctness for all edge cases. For bash/zsh, `printf '%q'` serves the same role.

### Signal channel split: `last_status` vs `prompt_ready`
A command completing (`last_status`) and the prompt being drawn (`prompt_ready`) are separate events. The extension must wait for both. If they arrive in the same FIFO write (same `feed()` call to the parser), the `waitFor("prompt_ready")` listener might not be registered yet when the event fires. Solution: send them as separate writes with a small delay, or register both listeners before feeding data.

### Persistent FIFOs with O_RDWR sentinel
The `O_RDWR` pattern is essential — without it, every writer close triggers EOF on the reader, requiring complex reconnection logic. With it, the reader just stays open and data flows continuously across writer cycles.

## Implementation Gotchas

### Event loop deadlocks with FIFOs
`writeSync` to a FIFO blocks if the kernel buffer is full. If the write happens on the same event loop as the reader (e.g., inside `setTimeout`), neither can make progress → deadlock. Fix: use child processes for writes that might exceed ~64KB.

### `createReadStream` FIFO ordering
MUST open the FIFO with `O_RDWR` via `openSync` BEFORE creating a `createReadStream`. If the stream opens first with `O_RDONLY`, it blocks until a writer appears. Since the O_RDWR fd IS the writer, the ordering matters.

### Vitest mock typing with `execSync`
When `execSync` is called with `encoding: "utf-8"`, it returns `string`, but the TypeScript overload signature makes the mock type `Buffer | string`. Using `as never` on mock return values satisfies strict mode without `@ts-ignore`.

### `unbuffer` in non-interactive contexts
The stock `unbuffer` (from expect) uses `interact` which blocks waiting for terminal input. In non-interactive contexts (agent's bash tool), this hangs forever. The fix: use `expect eof` instead of `interact`, and disable PTY echo in pipeline mode.

## Testing Insights

### Real FIFOs > mocked FIFOs
The `O_RDWR` sentinel pattern, kernel buffer behavior, and EOF semantics are OS-level concerns that mocks can't accurately reproduce. All FIFO tests use real `mkfifo` and real file descriptors.

### Escape tests are inherently slow
Each `escapeForFish` round-trip test spawns a `fish` subprocess (~400ms). With 22 escape tests, that's ~9 seconds. This is unavoidable — we're validating against the real fish parser, not a reimplementation.

### Shell integration tests need careful error capture
`execSync` throws when the command exits non-zero. To test error output from shell scripts, either catch the error and inspect it, or append `|| true` to the command and use `2>&1` redirection.

## Task Management

### Batch ticket operations are essential
Updating 5+ tickets manually is tedious and error-prone. Shell loops with `sed -i` are much more reliable. The tasks skill now documents this pattern.

### TDD ticket pairing
Picking up the test ticket (e.g., SHR-32 "FIFO manager unit tests") alongside the implementation ticket (SHR-10 "FIFO creation") reinforces the test-first discipline. Both tickets move through statuses together.

### `jj commit` frequency
Without a staging area, `jj commit` captures everything in the working copy. Committing after each logical unit of work (one module + its tests) keeps the history clean. Waiting too long produces monolithic commits that are hard to split retroactively.
