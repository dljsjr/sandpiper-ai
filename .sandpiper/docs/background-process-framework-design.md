# Background Process Framework — Design Sketch

AGENT-15. Framework-independent process manager in `sandpiper-ai-core`,
exposed to the agent via tool calls registered in `system.ts`.

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

  // Stream callbacks — consumers handle parsing
  onStdout(handler: (data: Buffer) => void): void;
  onStderr(handler: (data: Buffer) => void): void;
  onExit(handler: (code: number | null, signal: string | null) => void): void;

  // Buffered output (accumulated since last read)
  readStdout(options?: { tail?: number; clear?: boolean }): string;
  readStderr(options?: { tail?: number; clear?: boolean }): string;

  // Lifecycle
  kill(signal?: string): void;
  write(data: string): void;
}

interface SpawnOptions {
  readonly id: string;
  readonly command: string;
  readonly args?: readonly string[];
  readonly cwd?: string;
  readonly env?: Record<string, string>;
}

interface ProcessManager {
  spawn(options: SpawnOptions): ManagedProcess;
  get(id: string): ManagedProcess | undefined;
  kill(id: string): void;
  killAll(): void;
  list(): readonly ManagedProcess[];

  // Completed processes that haven't been acknowledged
  getCompletedUnacknowledged(): readonly ManagedProcess[];
  acknowledge(id: string): void;
}
```

### Extension Glue: Tool Registration (system.ts)

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
pi.on('context', async (event, ctx) => {
  const completed = processManager.getCompletedUnacknowledged();
  if (completed.length === 0) return;

  const notifications = completed.map(p =>
    `Background process "${p.id}" exited with code ${p.exitCode}.`
  ).join('\n');

  for (const p of completed) processManager.acknowledge(p.id);

  return {
    messages: [
      ...event.messages,
      { role: 'user', content: [{ type: 'text', text: notifications }] },
    ],
  };
});
```

The agent sees "Background process X finished" naturally in its next turn
without requiring explicit polling. The `acknowledge` call prevents repeat
notifications.

### Lifecycle: Session Teardown

```typescript
pi.on('session_shutdown', async () => {
  processManager.killAll();
});
```

## What This Enables

### Shell Relay (SHR-79)

The relay would use `ProcessManager` directly (not via tool calls) for its own
infrastructure:

```typescript
// Start subscribe stream
const sub = processManager.spawn({
  id: 'zellij-subscribe',
  command: 'zellij',
  args: ['--session', session, 'subscribe', '--pane-id', paneId, '--format', 'json'],
});

// Extension-level consumer parses NDJSON
sub.onStdout((data) => {
  // Parse viewport updates, detect prompt_ready patterns, etc.
});
```

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

## Open Questions

1. **Buffer size limits** — stdout can accumulate fast. Ring buffer? Max size with oldest-dropped?
2. **Process restart** — should the framework support auto-restart on exit? Or is that the consumer's job?
3. **Multiple consumers** — if both the relay extension and a tool call want the same process's output, how do we handle that? Broadcast vs. single reader?
4. **Stdin** — the `write` method on ManagedProcess allows writing to stdin. Is this needed for any current use case, or can we defer it?
5. **`context` injection format** — should the notification be a user message, a system message, or something else? User message would trigger a response; system message would be informational.
