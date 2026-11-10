# Background Process Framework — Design Sketch

- **Diátaxis mode**: Reference spec with explanatory design notes
- **Status**: ✅ **IMPLEMENTED** (Core) + ⚠️ **PARTIAL** (Notifications, Buffer Limits)
- **Implementation**: `packages/core/src/process-manager.ts`, `extensions/system/background-process-tools.ts`
- **Last verified**: 2026-04-16

---

## Implementation Status

### ✅ Implemented

- `ProcessManager` class in `sandpiper-ai-core` (framework-independent)
- `ManagedProcess` with lifecycle control, output buffering, event callbacks
- `spawn()`, `get()`, `killAll()` methods
- `onExit()` callbacks
- `readStdout()`, `readStderr()` with `tail` and `clear` options
- `getCompletedUnacknowledged()` and `acknowledge()` for notification deduplication
- `start_background_process` tool (agent-facing)
- `check_background_process` tool with `include_stdout`, `include_stderr`, `tail_lines`, `clear_buffer` parameters

### ⚠️ Partial / Not Implemented

| Feature                                              | Status             | Notes                                                                       |
| ---------------------------------------------------- | ------------------ | --------------------------------------------------------------------------- |
| Passive completion notifications via `context` event | ❌ Not implemented | Design specifies automatic injection when process exits. Not wired up.      |
| Buffer size limits                                   | ❌ Not implemented | Buffers are unbounded. No ring buffer or max size.                          |
| Process restart                                      | ❌ Not implemented | No auto-restart logic. Consumer responsibility.                             |
| PTY support                                          | ❌ Not implemented | Uses standard `child_process.spawn()` with pipes. PTY discussed but punted. |

### 🔍 Needs Verification

- Session teardown (`killAll()` on `session_shutdown`) — verify registration in `background-process-tools.ts`
- `context` event handler for completion notifications — may be implemented but not found in initial review

---

AGENT-15. Framework-independent process manager in `sandpiper-ai-core`,
exposed to the agent via tool calls registered in `background-process-tools.ts`.

## Problem

The agent needs to run long-lived background processes (e.g., `zellij subscribe`,
file watchers, build servers) without blocking the conversation. Pi's tool execution
model is synchronous — the LLM waits for the tool result before processing the
next message. We need a way to start processes that outlive the tool call.

## Architecture

### Core: `ProcessManager` (sandpiper-ai-core)

Framework-independent. No pi/sandpiper imports. Manages spawned child processes
with lifecycle control, output buffering, and event callbacks.

```typescript
interface ManagedProcess {
  readonly id: string;
  readonly pid: number | undefined;
  readonly running: boolean;
  readonly exitCode: number | null;
  readonly exitSignal: string | null;

  onExit(handler: (code: number | null, signal: string | null) => void): void;

  // Buffered output (accumulated since last read)
  readStdout(options?: { tail?: number; clear?: boolean }): string;
  readStderr(options?: { tail?: number; clear?: boolean }): string;

  // Lifecycle
  kill(signal?: string): void;
}

interface SpawnOptions {
  readonly id: string;
  readonly command: string;
  readonly args?: readonly string[];
  readonly cwd?: string;
}

interface ProcessManager {
  spawn(options: SpawnOptions): ManagedProcess;
  get(id: string): ManagedProcess | undefined;
  killAll(): void;

  // Completed processes that haven't been acknowledged
  getCompletedUnacknowledged(): readonly ManagedProcess[];
  acknowledge(id: string): void;
}
```

### Extension Glue: Tool Registration (background-process-tools.ts)

Two tools registered for agent interaction:

#### `start_background_process`

Spawns a process and returns immediately. Chat is unblocked.

```typescript
// Agent calls:
{ command: "zellij", args: ["subscribe", "--pane-id", "terminal_1", "--format", "json"], id: "zellij-subscribe" }

// Returns immediately:
{ id: "zellij-subscribe", pid: 12345, status: "running" }
```

#### `check_background_process`

Polls a process for status. Parameterized to control context cost.

```typescript
// Lightweight status check (default — no output in response):
{ id: "zellij-subscribe" }
// Returns: { id: "zellij-subscribe", status: "running", pid: 12345 }

// Status + last 20 lines of stdout:
{ id: "zellij-subscribe", include_stdout: true, tail_lines: 20 }
// Returns: { status: "running", stdout: "...", stdout_lines_available: 1542 }

// Status + all stderr + clear buffer:
{ id: "zellij-subscribe", include_stderr: true, clear_buffer: true }

// Check on a completed process:
{ id: "my-build" }
// Returns: { status: "exited", exit_code: 0 }
```

Parameters:

- `id` — process to check (required)
- `include_stdout` — include buffered stdout in response (default: false)
- `include_stderr` — include buffered stderr in response (default: false)
- `tail_lines` — only include last N lines when including output
- `clear_buffer` — discard buffered output after reading

### Passive Completion Notifications via `context` Event

When a background process exits, the `ProcessManager` records the completion.
On the next LLM turn, a `context` event handler checks for unacknowledged
completions and injects a system message:

```typescript
pi.on("context", async (event, ctx) => {
  const completed = processManager.getCompletedUnacknowledged();
  if (completed.length === 0) return;

  const notifications = completed
    .map((p) => `Background process "${p.id}" exited with code ${p.exitCode}.`)
    .join("\n");

  for (const p of completed) processManager.acknowledge(p.id);

  return {
    messages: [
      ...event.messages,
      { role: "user", content: [{ type: "text", text: notifications }] },
    ],
  };
});
```

The agent sees "Background process X finished" naturally in its next turn
without requiring explicit polling. The `acknowledge` call prevents repeat
notifications.

### Lifecycle: Session Teardown

```typescript
pi.on("session_shutdown", async () => {
  processManager.killAll();
});
```

## What This Enables

### Agent-Initiated Background Work

The agent could start builds, tests, or other long-running tasks:

```
Agent: "I'll start the test suite in the background while we work on the next feature."
→ start_background_process { id: "tests", command: "bun", args: ["test"] }
← { id: "tests", pid: 54321, status: "running" }

... later, on next turn ...
← (context injection) "Background process 'tests' exited with code 1."

Agent: "The tests failed. Let me check the output."
→ check_background_process { id: "tests", include_stderr: true, tail_lines: 50 }
← { status: "exited", exit_code: 1, stderr: "..." }
```

## Pi Framework State-Sharing Mechanisms

Full inventory of how extensions can share state, communicate with the LLM,
and persist data. Assessed for relevance to the background process framework.

| Mechanism                   | LLM context?           | Persisted? | Triggers turn?     | Direction                 |
| --------------------------- | ---------------------- | ---------- | ------------------ | ------------------------- |
| `pi.events` (event bus)     | No                     | No         | No                 | Extension ↔ Extension     |
| `context` event handler     | Yes (injects messages) | No         | No (piggybacks)    | Extension → LLM           |
| `before_agent_start` return | Yes (system prompt)    | No         | No                 | Extension → LLM           |
| `sendMessage`               | Yes (if display:true)  | Yes        | Optional           | Extension → Chat + LLM    |
| `sendUserMessage`           | Yes                    | Yes        | Always             | Extension → LLM           |
| `appendEntry`               | **No**                 | Yes        | No                 | Extension → Session       |
| `ctx.ui.notify`             | No                     | No         | No                 | Extension → User          |
| `ctx.ui.setWidget`          | No                     | No         | No                 | Extension → User          |
| `ctx.ui.setStatus`          | No                     | No         | No                 | Extension → User (footer) |
| `process.env`               | No                     | No         | No                 | Global                    |
| Tool `onUpdate` callback    | Yes (partial)          | No         | No (mid-execution) | Tool → LLM                |
| Tool return value           | Yes                    | Yes        | No                 | Tool → LLM                |

### Mechanisms chosen for the framework

- **`pi.events`** — internal extension-to-extension signaling. "Process X finished,
  another extension should react." Synchronous, in-memory, no persistence overhead.

- **`context` event** — passive LLM notifications. Inject "background process X
  exited with code 0" into the next LLM call without triggering a new turn.
  Non-persistent (injected per-call), zero context cost when nothing to report.

- **`appendEntry`** — sparingly, for cross-session state recovery if we ever need
  to resume knowledge of processes that were running when the session was interrupted.
  Does NOT enter LLM context, but does grow the JSONL file — use judiciously for
  high-volume data.

### Mechanisms explicitly not used

- **`sendMessage`** — persists to JSONL, causes duplication on --resume. Wrong for
  transient notifications.
- **`sendUserMessage`** — too aggressive. Always triggers a turn, would interrupt
  the agent's current work.
- **`before_agent_start`** — fires once at the start, not suitable for ongoing
  process status updates.
- **Tool `onUpdate`** — only works during tool execution. Background processes
  outlive their tool call by definition.

## Open Questions

1. **Buffer size limits** — stdout can accumulate fast. Ring buffer? Max size with oldest-dropped?
2. **Process restart** — should the framework support auto-restart on exit? Or is that the consumer's job?
3. **Multiple consumers** — if both an extension and a tool call want the same process's output, how do we handle that? Broadcast vs. single reader?
4. **`context` injection format** — should the notification be a user message, a system message, or something else? User message would trigger a response; system message would be informational.
