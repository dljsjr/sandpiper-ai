# Background processes

- **Diátaxis mode**: Reference spec with explanatory notes
- **Status**: Implemented. AGENT-70, a tool to stop one process, is open.
- **Implementation**: `packages/core/src/process-manager.ts`, `packages/core/src/background-process-capability.ts`, `extensions/system/background-process-tools.ts`, `extensions/system/background-process-hooks.ts`, `packages/core/src/system-notification.ts`
- **Related**: [Deferred tools](sandpiper-system-prompt.md#deferred-tools) (why both tools stay loaded), [original design sketch](../../archive/background-process-framework-design-2026-04.md) (archived)

The system extension lets the model run long-lived commands, such as dev servers, watchers, and test suites, without blocking the conversation. A Pi tool call returns before the model continues, so a background process has to outlive the tool call that starts it.

## Tools

Both tools have `direct` exposure.

### `start_background_process`

| Parameter | Type     | Required | Description                                                                             |
| --------- | -------- | -------- | --------------------------------------------------------------------------------------- |
| `id`      | string   | yes      | Identifier for the process. `check_background_process` and the exit notification use it |
| `command` | string   | yes      | Executable to run. No shell parses it                                                   |
| `args`    | string[] | no       | Arguments, one per element                                                              |
| `cwd`     | string   | no       | Absolute working directory. Default: the session's working directory                    |

- The process starts with `child_process.spawn()`, the given arguments, Sandpiper's environment, and piped stdin, stdout, and stderr. Nothing is written to stdin.
- The tool returns at once with the PID: `details` is `{ id, pid, status: 'running' }`.
- An `id` whose process is still running is refused with an error. An `id` whose process has exited is reused, and the old process's output is discarded.
- A command that cannot start, such as a missing executable, still returns a started result, with no PID. Its stderr then holds `spawn error: <message>`, and it exits once, with the negative error number as its exit code: `-2` for a missing executable or working directory, `-13` for a file that is not executable. The model gets one exit notification, and `check_background_process` reports the same code.

### `check_background_process`

| Parameter        | Type    | Required | Description                                       |
| ---------------- | ------- | -------- | ------------------------------------------------- |
| `id`             | string  | yes      | The process to check                              |
| `include_stdout` | boolean | no       | Include buffered stdout. Default: false           |
| `include_stderr` | boolean | no       | Include buffered stderr. Default: false           |
| `tail_lines`     | number  | no       | Return only the last N lines of each stream       |
| `clear_buffer`   | boolean | no       | Empty each returned stream's buffer after reading |

The result text is `Process "<id>": running` or `exited`, with the PID, then `Exit code: <code>` once the process has exited, then each requested stream with its count of buffered lines. `details` is `{ id, pid, running, exitCode, exitSignal }`. An unknown `id` is an error.

## Exit notification

When a process exits, the tool sends a hidden system notification with `deliverAs: "steer"` and `triggerTurn: true`. A busy session receives it as a steering message. An idle session starts a run for it, which carries the Sandpiper prompt like any other run. The notification is recorded in the session.

```text
<sandpiper_system_notification source_type="tool" source_id="background_process">
  <instructions>A background process started with start_background_process completed. Use check_background_process if you need its final output before continuing.</instructions>
  <process id="tests" exitCode="1" exitSignal="null"/>
</sandpiper_system_notification>
```

Both tools carry a guideline that tells the model not to poll in a loop and to wait for the notification.

## Lifecycle

- On `session_shutdown`, every process gets `SIGTERM` (`background-process-hooks.ts`). No process outlives the session, and none is restored when a session resumes.
- No tool stops a single process. `ManagedProcess.kill()` exists for code; AGENT-70 tracks a stop tool.

## Output buffers

- stdout and stderr are kept in separate in-memory lists of lines until the process's `id` is reused or the session ends.
- Each chunk the process writes is split on newlines, and empty lines are dropped. A line that arrives in two chunks is stored as two lines.
- The buffers have no size limit.

## `ProcessManager`

`packages/core/src/process-manager.ts` imports nothing from Pi or Sandpiper.

| Member                                                                  | Meaning                                                                                  |
| ----------------------------------------------------------------------- | ---------------------------------------------------------------------------------------- |
| `ProcessManager.spawn({ id, command, args, cwd })`                      | Starts a process and returns its `ManagedProcess`. Throws if `id` is running             |
| `ProcessManager.get(id)`                                                | The `ManagedProcess` for `id`, running or exited                                         |
| `ProcessManager.killAll(signal?)`                                       | Sends `signal`, default `SIGTERM`, to every running process                              |
| `ManagedProcess.id`, `pid`, `running`, `exitCode`, `exitSignal`, `info` | State. `info` is a plain `ProcessInfo` snapshot                                          |
| `ManagedProcess.onExit(handler)`                                        | Calls `handler(code, signal)` when the process closes or fails to start                  |
| `ManagedProcess.readStdout(options?)`, `readStderr(options?)`           | Buffered lines joined with newlines. `tail` keeps the last N; `clear` empties the buffer |
| `ManagedProcess.stdoutLineCount`, `stderrLineCount`                     | Buffered line counts                                                                     |
| `ManagedProcess.kill(signal?)`                                          | Sends `signal`, default `SIGTERM`, if the process is running                             |

`background-process-capability.ts` maps the tool parameters onto these calls without Pi types.

## Known gaps

| Gap                   | Notes                                                                                                                                            |
| --------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------ |
| No stop tool          | AGENT-70                                                                                                                                         |
| Unbounded buffers     | A chatty process grows memory for the rest of the session. AGENT-28                                                                              |
| Lines split at chunks | See [Output buffers](#output-buffers)                                                                                                            |
| No restart            | A process that exits stays exited. AGENT-46                                                                                                      |
| No terminal           | Pipes, not a PTY. Programs that check for a terminal can behave differently. AGENT-65                                                            |
| One reader            | `clear_buffer` empties the buffer for every later reader. AGENT-47 dropped a broadcast design when its second consumer, Shell Relay, was removed |

## Design notes

- The exit notification uses a system notification with `triggerTurn` instead of the original design's `context` injection. A `context` injection waits for the next model call, so an idle agent would not learn of the exit until the user spoke again.
- Both tools stay `direct` rather than `deferred`: Pi lists a tool's guidelines only while the tool is declared, and the guideline to prefer `start_background_process` over `&` or `nohup` steers ordinary coding work.
