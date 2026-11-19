# Background processes

- **Diátaxis mode**: Reference spec with explanatory notes
- **Status**: Implemented.
- **Implementation**: `packages/core/src/process-manager.ts`, `packages/core/src/background-process-capability.ts`, `extensions/system/background-process-tools.ts`, `extensions/system/background-process-hooks.ts`, `packages/core/src/system-notification.ts`
- **Related**: [Deferred tools](sandpiper-system-prompt.md#deferred-tools) (why the start and check tools stay loaded), [original design sketch](../../archive/background-process-framework-design-2026-04.md) (archived)

The system extension lets the model run long-lived commands, such as dev servers, watchers, and test suites, without blocking the conversation. A Pi tool call returns before the model continues, so a background process has to outlive the tool call that starts it.

## Tools

`start_background_process` and `check_background_process` have `direct` exposure. `stop_background_process` is `deferred`: `tool_search` loads it when the model needs it.

### `start_background_process`

| Parameter | Type     | Required | Description                                                                                                         |
| --------- | -------- | -------- | ------------------------------------------------------------------------------------------------------------------- |
| `id`      | string   | yes      | Identifier for the process. `check_background_process`, `stop_background_process`, and the exit notification use it |
| `command` | string   | yes      | Executable to run. No shell parses it                                                                               |
| `args`    | string[] | no       | Arguments, one per element                                                                                          |
| `cwd`     | string   | no       | Absolute working directory. Default: the session's working directory                                                |

- The process starts with `child_process.spawn()`, the given arguments, Sandpiper's environment, and piped stdin, stdout, and stderr. Nothing is written to stdin.
- The tool returns at once with the PID: `details` is `{ id, pid, status: 'running' }`.
- An `id` whose process is still running is refused with an error. An `id` whose process has exited is reused, and the old process's output is discarded.
- A command that cannot start, such as a missing executable, still returns a started result, with no PID. Its stderr then holds `spawn error: <message>`, and it exits once, with the negative error number as its exit code: `-2` for a missing executable or working directory, `-13` for a file that is not executable. The model gets one exit notification, and `check_background_process` reports the same code.

### `check_background_process`

| Parameter        | Type    | Required | Description                                                                                            |
| ---------------- | ------- | -------- | ------------------------------------------------------------------------------------------------------ |
| `id`             | string  | yes      | The process to check                                                                                   |
| `include_stdout` | boolean | no       | Include buffered stdout. Default: false                                                                |
| `include_stderr` | boolean | no       | Include buffered stderr. Default: false                                                                |
| `tail_lines`     | number  | no       | Return only the last N lines of each stream                                                            |
| `clear_buffer`   | boolean | no       | Start a fresh buffer for each returned stream after reading, so the next check shows only newer output |

The result text is `Process "<id>": running` or `exited`, with the PID, then `Exit code: <code>` once the process has exited, then each requested stream with its total line count and size. A stream that outgrew its buffer ends with a note in the `bash` tool's form, `[Showing lines <first>-<last> of <total>. Full output: <path>]`. `details` is `{ id, pid, running, exitCode, exitSignal }`. An unknown `id` is an error.

### `stop_background_process`

| Parameter | Type   | Required | Description                                           |
| --------- | ------ | -------- | ----------------------------------------------------- |
| `id`      | string | yes      | The process to stop                                   |
| `signal`  | string | no       | `SIGTERM`, `SIGINT`, or `SIGKILL`. Default: `SIGTERM` |

- The tool sends the signal and waits up to 5 seconds for the process to exit. The result is `Background process "<id>" stopped (signal: <signal>)`, or `(exit code: <code>)` when the process exits on its own terms.
- A process still running after the wait gets a result that says so and suggests calling again with `SIGKILL`.
- A process that had already exited is reported as such and not signalled. An unknown `id` is an error.
- No exit notification follows a stop the model asked for, even when the process exits after the wait. The tool result already carries the outcome, and a notification would start another run to repeat it.
- `details` is `{ id, pid, running, exitCode, exitSignal }`.

## Exit notification

When a process exits, unless `stop_background_process` stopped it, the tool sends a hidden system notification with `deliverAs: "steer"` and `triggerTurn: true`. A busy session receives it as a steering message. An idle session starts a run for it, which carries the Sandpiper prompt like any other run. The notification is recorded in the session.

```text
<sandpiper_system_notification source_type="tool" source_id="background_process">
  <instructions>A background process started with start_background_process completed. Use check_background_process if you need its final output before continuing.</instructions>
  <process id="tests" exitCode="1" exitSignal="null"/>
</sandpiper_system_notification>
```

Both tools carry a guideline that tells the model not to poll in a loop and to wait for the notification.

## Lifecycle

- On `session_shutdown`, every process gets `SIGTERM` (`background-process-hooks.ts`). No process outlives the session, and none is restored when a session resumes.
- `stop_background_process` stops one process. Code can call `ManagedProcess.kill()` or `stopBackgroundProcess()` in `background-process-capability.ts`.

## Output buffers

Each stream has its own Pi `OutputAccumulator`, the buffer behind Pi's `bash` tool. The local Pi patch exports it from Pi's root (see [the build system](../../../docs/dev/build-system.md#local-pi-patch)).

- The output is kept exactly as written, blank lines included, until the process's `id` is reused or the session ends.
- A read shows at most the last 2000 lines or 50 KB of a stream. Memory holds a bounded tail of about twice that.
- Once a stream passes either limit, the whole stream, from its first byte, also goes to `$TMPDIR/sandpiper-bg-<id>-<stream>-<random>.log`. Only the user can read it (mode 0600). Characters other than letters, digits, `_`, and `-` in the `id` become `_`. The files are never deleted, like the `bash` tool's.
- When the process exits, both buffers finish and their files are flushed before the exit handlers run, so the exit notification never points at a partial file.
- `clear_buffer` closes the stream's buffer and starts an empty one. A file the old buffer wrote stays on disk; the result that cleared it gave its path.

## `ProcessManager`

`packages/core/src/process-manager.ts` imports nothing from Pi or Sandpiper. `new ProcessManager({ createOutputBuffer })` takes a factory that makes one buffer per process and stream; the system extension passes `createBackgroundProcessOutputBuffer` from `background-process-tools.ts`, which returns Pi's `OutputAccumulator`.

| Member                                                                  | Meaning                                                                                                                                |
| ----------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------- |
| `ProcessManager.spawn({ id, command, args, cwd })`                      | Starts a process and returns its `ManagedProcess`. Throws if `id` is running                                                           |
| `ProcessManager.get(id)`                                                | The `ManagedProcess` for `id`, running or exited                                                                                       |
| `ProcessManager.killAll(signal?)`                                       | Sends `signal`, default `SIGTERM`, to every running process                                                                            |
| `ManagedProcess.id`, `pid`, `running`, `exitCode`, `exitSignal`, `info` | State. `info` is a plain `ProcessInfo` snapshot                                                                                        |
| `ManagedProcess.onExit(handler)`                                        | Calls `handler(code, signal)` when the process closes or fails to start                                                                |
| `ManagedProcess.readStdout(options?)`, `readStderr(options?)`           | `{ text, totalLines, totalBytes, truncated, fullOutputPath? }`. `tail` keeps the last N lines of `text`; `clear` starts a fresh buffer |
| `ManagedProcess.kill(signal?)`                                          | Sends `signal`, default `SIGTERM`, if the process is running                                                                           |

`background-process-capability.ts` maps the tool parameters onto these calls without Pi types.

## Known gaps

| Gap         | Notes                                                                                                                                            |
| ----------- | ------------------------------------------------------------------------------------------------------------------------------------------------ |
| No restart  | A process that exits stays exited; start the same `id` again. Not planned: AGENT-46 was closed in the 2026-11-19 triage                          |
| No terminal | Pipes, not a PTY. Programs that check for a terminal can behave differently. Not planned: AGENT-65 was closed in the 2026-11-19 triage           |
| One reader  | `clear_buffer` empties the buffer for every later reader. AGENT-47 dropped a broadcast design when its second consumer, Shell Relay, was removed |

## Design notes

- The exit notification uses a system notification with `triggerTurn` instead of the original design's `context` injection. A `context` injection waits for the next model call, so an idle agent would not learn of the exit until the user spoke again.
- Both tools stay `direct` rather than `deferred`: Pi lists a tool's guidelines only while the tool is declared, and the guideline to prefer `start_background_process` over `&` or `nohup` steers ordinary coding work.
