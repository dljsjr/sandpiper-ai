# Shell Relay — Product Requirements Document

## Overview

**Shell Relay** is a pi extension that gives the coding agent access to a persistent, shared terminal session — a multiplexer pane that both the user and agent can observe and interact with in real time. Think of it as a Google Doc, but for a shell: both the user and the agent are equal participants with full control. Either party can run commands, inspect state, or interact with the session at any time. This transforms the agent's shell access from isolated, ephemeral command execution into a fully collaborative workspace.

The extension registers a custom tool (`shell_relay`) that the agent can invoke alongside the built-in `bash` tool. Commands execute in a designated Zellij pane running the user's shell, with stdout and stderr captured separately via persistent FIFOs and `tee`, completion detected via a shell prompt hook signal channel, and exit codes captured reliably inside the command wrapper. When `expect`/`tclsh` is available, a custom PTY wrapper (`unbuffer-relay`) preserves ANSI colors through the capture pipeline. The background shell type (fish, zsh, bash, etc.) is determined by whatever the user is running in the target pane.

### Additional Benefits

Because commands execute in the user's existing shell session rather than forked processes, Shell Relay also enables:

- **Session state inheritance.** Shell functions, non-exported variables, activated virtual environments, sourced scripts, and other runtime state are available to agent-executed commands.
- **Authentication continuity.** Per-process-tree auth mechanisms (e.g., 1Password Desktop App biometric sessions via `op run`) persist across multiple agent commands without re-prompting. A single interactive authentication carries forward.
- **Security without compromise.** Sensitive credentials don't need to be persisted to disk or exported to environment variables — the agent inherits them naturally from the session.

## Problem Statement

The pi agent executes all commands by forking new `bash` processes via the built-in `bash` tool. Each invocation is an independent, ephemeral process with no relationship to the user's interactive shell session or to any other agent-executed command. This creates two categories of problems:

### No Shared Context Between User and Agent

The agent's command execution is invisible to the user and vice versa. The user cannot observe what the agent is running, cannot inspect intermediate state, and cannot intervene or collaborate in real time. The agent, in turn, has no awareness of the user's terminal environment — it operates in a completely separate context. There is no shared workspace where both parties can see and act on the same shell state.

### No Persistence Across Commands

Each forked process is a fresh environment. State accumulated during one command (authentication tokens, environment modifications, shell function definitions, process-tree-scoped credentials) is discarded before the next. This leads to specific problems:

1. **Authentication state is not inherited.** Tools that use per-process-tree auth (e.g., `op run` via 1Password Desktop App) require fresh biometric approval for every forked command, making unattended agent workflows impossible.

2. **Session-scoped state is lost.** Shell functions defined interactively, non-exported variables, and runtime state (e.g., activated virtual environments, sourced scripts) are unavailable in forked processes.

3. **Workarounds compromise security or ergonomics.** Persisting tokens to disk, disabling biometric auth, or exporting secrets to environment variables all trade security for convenience.

### Success Criteria

- The user and agent share a visible, persistent terminal session that both can observe and interact with.
- The agent can execute commands in the user's shell session, inheriting all session state (environment, functions, auth tokens).
- The user can observe command execution in real time and interact with the shared session freely — running their own commands, responding to interactive prompts, or terminating runaway processes.
- The agent can inspect the visual state of the shared terminal at any time, including output from commands the user has run independently.
- A single interactive authentication (e.g., 1Password biometric) persists across multiple agent-invoked commands without re-prompting.
- The solution is shell-agnostic: fish, zsh, bash, and others are supported.
- The solution integrates cleanly with the pi extension framework as a custom tool.
- Command output is reliably captured and returned to the agent.

## Potential Approaches

### Rejected: Pure Unix Domain Socket (Cooperative Server)

A cooperative server approach — where a shell function listens on a Unix domain socket, accepts commands, and returns structured responses — was considered and rejected. While it excels at structured I/O (clean stdout/stderr/exit code separation, unbounded output, synchronous request-response), it is fundamentally incompatible with the primary goal of a shared, observable terminal. UDS execution is headless: neither the user nor the agent can see commands running, inspect visual state, or interact with the session in real time. It solves the secondary benefits (auth inheritance, session state) but not the core feature. Elements of the UDS approach (specifically, using pipes for structured output capture) are incorporated into the recommended hybrid approach below.

### Pure Multiplexer (tmux / Zellij)

Use a terminal multiplexer's IPC to inject commands into a pane and capture output via screen-scraping.

**Mechanism (tmux):**
- `tmux send-keys -t <target> "<command>" Enter` to inject commands
- `tmux capture-pane -t <target> -p` to capture visible pane content
- Sentinel/marker patterns to delimit command output

**Mechanism (Zellij):**
- `zellij action write-chars "<command>\n"` to inject commands
- `zellij action dump-screen <file>` to capture pane contents
- Pane targeting via `--pane-id` flag or `focus-pane-with-id`

**Advantages:**
- No shell-side server component needed; the multiplexer is the server
- Works with any shell (multiplexer doesn't care what runs in the pane)
- Full user and agent observability — commands and output visible in real time, pane state inspectable at any time
- Fully collaborative — both user and agent can interact with the pane

**Disadvantages:**
- Output capture is inherently unreliable:
  - Screen capture is limited to visible/scrollback buffer; long output may be truncated
  - Sentinel-based output delimiting is fragile and timing-dependent
  - No clean separation of stdout vs. stderr
  - Exit code requires injecting additional commands (e.g., `echo $?`)
- Commands injected as simulated keystrokes — quoting/escaping is error-prone
- No programmatic "command finished" signal; must poll or use heuristics
- Race conditions between command injection and output capture

### Multiplexer + Dual FIFO Capture + Signal Channel (Recommended)

Combine a terminal multiplexer for the shared collaborative terminal with **persistent FIFOs** for separated stdout/stderr capture, a **signal channel** FIFO for event-driven completion detection, and an optional **PTY wrapper** (`unbuffer-relay`) for ANSI color preservation. Agent commands are wrapped in a `tee`-based capture pattern; output flows to both the terminal (user sees it) and the FIFOs (agent reads it). A prompt hook signals readiness and the command wrapper reports exit codes directly to the signal channel.

**Architecture:**

```
┌──────────────────────┐                      ┌─────────────────────────────┐
│  pi extension        │   write-chars        │  zellij pane                │
│  (shell_relay tool)  │ ────────────────────► │  (user's shell session)     │
│                      │                      │                             │
│                      │   stdout FIFO        │  command wrapper:           │
│                      │ ◄──── (persistent) ──│  { [unbuffer-relay -p]      │
│  reads stdout        │                      │    CMD                      │
│                      │   stderr FIFO        │    | tee $STDOUT > /dev/tty │
│                      │ ◄──── (persistent) ──│  } 2>&1 >/dev/null         │
│  reads stderr        │                      │    | tee $STDERR > /dev/tty │
│                      │                      │                             │
│                      │   signal FIFO        │  wrapper writes:            │
│                      │ ◄──── (persistent) ──│    last_status:EXIT_CODE    │
│  reads signals       │                      │  prompt hook writes:        │
│                      │                      │    prompt_ready              │
│                      │                      │                             │
│                      │   dump-screen        │  user and agent both see    │
│                      │ ◄──── (on demand) ───│  everything in real time    │
│  visual inspection   │                      │                             │
└──────────────────────┘                      └─────────────────────────────┘
```

**Capture pattern (fish syntax):**

```fish
# Enhanced mode (with unbuffer-relay):
{ unbuffer-relay -p CMD | tee $STDOUT_FIFO > /dev/tty; set -g __relay_exit $pipestatus[1]; } 2>&1 >/dev/null | tee $STDERR_FIFO > /dev/tty
echo "last_status:$__relay_exit" > $SIGNAL_FIFO

# Basic mode (no unbuffer-relay):
{ CMD | tee $STDOUT_FIFO > /dev/tty; set -g __relay_exit $pipestatus[1]; } 2>&1 >/dev/null | tee $STDERR_FIFO > /dev/tty
echo "last_status:$__relay_exit" > $SIGNAL_FIFO
```

See **FR-3** and **FR-14** for the capture pattern specification, **FR-4** for persistent FIFO management (including the `O_RDWR` sentinel pattern), **FR-9** for the signal channel protocol, and **FR-15** for the `unbuffer-relay` PTY wrapper.

**Command execution flow:**

1. Extension confirms pane is at prompt (last signal was `prompt_ready`) — **FR-8**
2. Extension injects the wrapped command via `zellij action write-chars` — **FR-3**
3. Extension reads stdout and stderr from their respective FIFOs as data arrives — **FR-4**
4. Extension waits for `last_status:EXIT_CODE` on the signal channel — command done — **FR-9**
5. Extension waits for `prompt_ready` on the signal channel — pane ready — **FR-9**
6. Extension returns structured result (stdout, stderr, exit code) to the agent

The agent can also inspect the visual state of the pane at any time via `zellij action dump-screen`, independent of the FIFO capture — **FR-6**.

**Three-tier capture modes:**

| Mode | When | Colors | Session state | Exit code | stdout/stderr |
|------|------|--------|--------------|-----------|---------------|
| **Enhanced** | `expect`/`tclsh` available | ✅ PTY preserved | ✅ in-session | ✅ `$pipestatus` | ✅ separated |
| **Basic** | Always (no deps) | ⚠️ `auto` programs lose color | ✅ in-session | ✅ `$pipestatus` | ✅ separated |
| **dump-screen** | Fallback / user commands | ✅ natural | ✅ in-session | via prompt hook | ❌ merged |

**Advantages:**
- **Fully collaborative terminal:** Both user and agent see commands and output in the pane in real time via `/dev/tty`. The pane displays naturally.
- **Separated stdout/stderr:** The agent receives stdout and stderr as distinct streams via separate FIFOs.
- **Reliable exit codes:** Captured inside the command wrapper via `$pipestatus[1]`, immune to pipeline masking and `unbuffer` exit code swallowing.
- **Color preservation (enhanced mode):** `unbuffer-relay` wraps commands in a PTY, so programs that check `isatty(stdout)` emit ANSI color codes. The captured stdout includes these codes.
- **No per-command FIFO lifecycle:** Persistent FIFOs with `O_RDWR` sentinel handles. Created once, reused across all commands, cleaned up at session end.
- **Event-driven completion:** Signal channel eliminates polling. `last_status` = command done, `prompt_ready` = pane ready.
- **True in-session execution:** Commands run in the user's authenticated shell pane with full session state.
- **Extensible signal channel:** Can carry additional event types in future versions.

**Disadvantages:**
- **Shell integration installation required:** The user must source a script in their shell RC file. This is a one-time setup step (mitigated by installation hooks).
- **Command wrapping is visible in the pane:** The user sees the `{ CMD | tee ... }` wrapper in the pane, not the raw command. This can be mitigated with terminal title overrides (see FR-14).
- **`isatty(stderr)` is false:** stderr flows through a pipe (`tee`), so programs that colorize stderr based on `isatty(stderr)` will lose stderr colors. Most programs base color decisions on `isatty(stdout)`, so impact is minor.
- **Zellij dependency (v1):** Requires Zellij. tmux support is deferred to future work.

## Trade-Off Analysis

| Criterion                        | Pure Multiplexer | Dual FIFO Capture + Signal Channel |
|----------------------------------|------------------|------------------------------------|
| **Shared collaborative terminal** | ✅ Full          | ✅ Full (via `/dev/tty`)           |
| **User observability**           | ✅ Full           | ✅ Full (via `/dev/tty`)           |
| **Agent visual inspection**      | ✅ dump-screen    | ✅ dump-screen (supplementary)     |
| **stdout/stderr separation**     | ❌ No              | ✅ Separate FIFOs                  |
| **Exit code reliability**        | ⚠️ Requires hack  | ✅ `$pipestatus` + signal channel  |
| **Completion detection**         | ❌ Poll/heuristic  | ✅ Event-driven (signal channel)   |
| **ANSI color preservation**      | ⚠️ Depends         | ✅ With `unbuffer-relay` / ⚠️ without |
| **Long output handling**         | ❌ Buffer-limited  | ✅ Unbounded (FIFO)                |
| **Race condition risk**          | ⚠️ High            | ✅ Low                             |
| **Output delimiting**            | ❌ Sentinel-based  | ✅ FIFO framing via signal channel |
| **Per-command overhead**         | ✅ None            | ⚠️ FIFO I/O + wrapper             |
| **Setup ceremony**               | ⚠️ Designate pane  | ⚠️ Designate pane + source shell integration |
| **Implementation complexity**    | ⚠️ Medium          | ⚠️ Medium                          |
| **Extensibility**                | ❌ Limited          | ✅ Signal channel reusable for future events |

### Recommendation

**Dual FIFO Capture + Signal Channel** is the recommended approach. It delivers the core feature (shared collaborative terminal) while solving every major weakness of the pure multiplexer approach: stdout/stderr are separated, exit codes are reliable, completion detection is event-driven, and output is unbounded (not limited by scrollback buffers). The optional `unbuffer-relay` PTY wrapper adds ANSI color preservation when `expect`/`tclsh` is available.

The primary engineering challenges are:
- **Shell integration scripts** — prompt hooks, wrapper functions, and Enter key binding for fish/bash/zsh
- **`unbuffer-relay`** — custom expect script (~25 lines) for PTY with exit code propagation
- **Persistent FIFO management** — `O_RDWR` sentinel pattern in Node.js
- **Signal channel protocol** — `last_status` / `prompt_ready` message framing

**Multiplexer target:** Zellij is the sole v1 target. tmux support is deferred to future work.

## Functional Requirements

### FR-1: Custom Tool Registration

The extension MUST register a `shell_relay` tool with the pi agent via `pi.registerTool()`.

### FR-2: Shell Parameterization

The tool MUST NOT hard-code a specific shell. The shell type running in the target pane is inherently whatever the user's session is running. Shell-specific behavior is limited to the prompt hook integration scripts (see FR-14). The extension:
- MUST provide shell integration scripts for fish, bash, and zsh
- SHOULD attempt to auto-detect the user's shell (via `$SHELL`) for installation guidance
- MAY support additional shells in future versions

### FR-3: Command Execution

The tool MUST accept a command string and execute it within the context of the user's existing shell session in the designated multiplexer pane, inheriting all session state (environment variables, functions, auth tokens, etc.).

The extension MUST wrap the command in a capture pattern before injection via `zellij action write-chars`. The wrapper:
- Pipes stdout through `tee` to the stdout FIFO and `/dev/tty` (terminal display)
- Redirects the group's stderr through `tee` to the stderr FIFO and `/dev/tty`
- Captures the real exit code via `$pipestatus[1]` inside the group
- Writes `last_status:EXIT_CODE` to the signal FIFO
- Optionally wraps the command in `unbuffer-relay -p` for PTY color preservation (see FR-15)

The wrapper function SHOULD be defined in the shell integration script (see FR-14) and invoked by the extension, rather than being constructed inline for each command injection.

**Command quoting strategy:** The command string MUST be escaped into a single safe token before injection, so that shell syntax (pipes, redirections, semicolons, quotes, variable expansions) is preserved through the wrapper function and correctly interpreted by `eval` inside the wrapper. The escaping mechanism is shell-specific:
- **Fish:** `string escape --style=script` produces a single-quoted token that round-trips through `eval` via `string unescape --style=script`. The extension MAY invoke `fish -c "string escape --style=script -- CMD"` or implement the escaping rules directly in Node.js.
- **Bash/Zsh:** `printf '%q'` produces a shell-escaped string safe for `eval`.

The injected command takes the form: ` __relay_run ESCAPED_COMMAND`

The space prefix excludes the command from shell history in shells that support history ignore patterns (fish default behavior, bash `HISTCONTROL=ignorespace`, zsh `HIST_IGNORE_SPACE`).

### FR-4: Output Capture via Persistent FIFOs

The tool MUST return:
- **stdout** — captured via the persistent stdout FIFO, written to by `tee` during command execution
- **stderr** — captured via the persistent stderr FIFO, written to by `tee` during command execution
- **Exit code** — captured from the signal channel's `last_status:EXIT_CODE` message

The extension MUST create three persistent FIFOs at session start (stdout, stderr, signal) and hold them open for the session lifetime using the `O_RDWR` sentinel pattern:
- FIFO paths MUST be deterministic, based on the relay session ID (e.g., `$XDG_RUNTIME_DIR/shell-relay/<session-id>/stdout`, `.../stderr`, `.../signal`). Deterministic paths allow the shell integration scripts to continue pointing at the correct FIFOs if the extension crashes and restarts, without needing to re-export environment variables.
- Open each FIFO with `O_RDWR` in Node.js — this prevents blocking on open AND acts as a sentinel (the FIFO never sees "all writers closed", so the reader never gets EOF)
- Read continuously from all three FIFOs using Node.js readable streams
- External writers (`tee`, prompt hook) open, write, and close per-command without disrupting the persistent reader
- Clean up all FIFOs at session end

The extension uses the signal channel for framing: data arriving on the stdout/stderr FIFOs between two `last_status` signals belongs to a single command execution.

### FR-5: User Observability

Command execution MUST be visible in the multiplexer pane in real time. The capture pattern uses `> /dev/tty` to route both stdout and stderr to the terminal, so the user sees all output as it happens. The user will see the wrapper syntax (e.g., `{ CMD | tee ... }`) in the pane rather than the raw command; this MAY be mitigated via terminal title overrides (see FR-14).

### FR-6: Agent Pane Inspection

The extension MUST provide a mechanism for the agent to inspect the current visual state of the target pane (via `dump-screen` or `capture-pane`). Because the shared terminal is fully bidirectional — the user may run commands, interact with programs, or modify state at any time — the agent MUST be able to read the pane to observe what has happened independently of its own command execution.

This MAY be implemented as:
- A separate tool (e.g., `shell_relay_inspect`)
- A parameter on the main tool (e.g., `inspect: true` with no command)
- An automatic inclusion in the tool result (e.g., last N lines of pane state)

### FR-7: Multiplexer Support

The extension MUST support Zellij as the sole v1 multiplexer target. The multiplexer interaction SHOULD be organized behind a clean interface to facilitate adding tmux support in future versions.

The Zellij integration MUST support:
- Command injection (`zellij action write-chars`)
- Pane content capture (`zellij action dump-screen --full` to a FIFO)
- Session and pane creation (`zellij attach --create`, pane creation commands)
- Pane/session targeting by ID
- Pane process state queries (`zellij action list-clients` or equivalent)

### FR-8: Pane Readiness Detection

Before injecting a command, the extension MUST verify that the target pane is in a ready state (at a shell prompt, not mid-command). Because the shared terminal is fully collaborative, the user may be actively using the pane when the agent needs it.

**Readiness detection** MUST be primarily driven by the signal channel — the most recent `prompt_ready` signal indicates the pane is at a prompt. Additional detection mechanisms MAY include:
- Querying the multiplexer for pane/process state (e.g., `zellij action list-clients` to detect if a non-shell process is running)
- Prompt string detection in pane dump output as a supplementary check

**When the pane is occupied:**
- The extension MUST NOT inject commands into a pane that is running a non-prompt process or is otherwise not at a shell prompt
- The extension SHOULD notify the user via pi's notification API (e.g., `ctx.ui.notify()`) that the agent is waiting for the pane to become available
- The extension MUST return a clear error to the agent if the pane is not ready within a configurable timeout

**User typing:** The extension does not need to detect whether the user is actively typing into the pane. Coordination between user and agent for this case is handled via the chat interface (e.g., the user tells the agent "the pane is yours" or the agent asks "are you done with the pane?").

### FR-9: Signal Channel

The extension MUST maintain a signal channel (FIFO) for event-driven communication from the shell back to the extension:

- The signal FIFO is one of the three persistent FIFOs created at session start (see FR-4)
- The extension MUST export the FIFO path as the `SHELL_RELAY_SIGNAL` environment variable into the target pane
- The extension MUST also export the stdout and stderr FIFO paths as `SHELL_RELAY_STDOUT` and `SHELL_RELAY_STDERR` environment variables
- The extension MUST listen on the signal FIFO asynchronously (Node.js async I/O with callbacks) at all times while the relay is active

The signal channel MUST use a line-delimited text protocol with two message types:
- **`last_status:N\n`** — written by the command wrapper immediately after CMD completes, reporting the real exit code from `$pipestatus[1]`. This is written from inside the capture group where the exit code is still accurate.
- **`prompt_ready\n`** — written by the shell prompt hook when the prompt is drawn, indicating the pane is at a shell prompt and ready for the next command.

These two message types serve distinct purposes: `last_status` signals command completion with exit code data, `prompt_ready` signals pane readiness. Both are needed — a command may complete (`last_status`) before the prompt is fully drawn and ready for input (`prompt_ready`).

The signal channel SHOULD be designed for extensibility — additional event types (e.g., `cwd_changed:PATH`, `env_updated:VAR=VALUE`) MAY be added in future versions.

### FR-10: Session and Pane Lifecycle

The extension MUST support three input configurations for connecting to or creating the shared terminal:

1. **No session or pane provided:** The extension creates a new multiplexer session (which automatically creates a pane) and reports the session and pane identifiers back to the user.
2. **Session provided, no pane:** The extension creates a new pane in the given session and reports the pane identifier back to the user.
3. **Session and pane provided:** The extension connects to the existing pane in the existing session.

The session and pane identifiers MAY be provided via:
- Environment variables (e.g., `SHELL_RELAY_SESSION`, `SHELL_RELAY_PANE_ID`)
- Extension configuration file
- Tool parameters
- A pi command (e.g., `/relay-connect <session> <pane>`)
- Interactive selection via `ctx.ui.select()` on first use

When the extension creates a session or pane, it MUST report the identifiers back to the user (e.g., via `ctx.ui.notify()` or tool result output) so the user knows where to find the shared terminal and can navigate to it in their multiplexer.

### FR-11: Security

- FIFOs MUST be created with user-only permissions (mode `0600`)
- FIFOs SHOULD be placed in `$XDG_RUNTIME_DIR` when available, falling back to `/tmp` with a user-specific subdirectory
- The FIFO directory SHOULD have mode `0700`

### FR-12: Concurrent Command Handling

The extension MUST serialize command execution to the target pane (one command at a time). Concurrent tool calls MUST be queued and executed sequentially, since the pane can only run one command at a time.

### FR-13: Timeout Support

The tool MUST support an optional timeout parameter. If a command exceeds the timeout:
- The extension SHOULD inject a kill signal (e.g., Ctrl+C via `write-chars`) into the pane
- The extension MUST return a timeout error to the agent, including any stdout/stderr captured up to the timeout point

### FR-14: Shell Integration Scripts

The extension MUST provide shell integration scripts that implement the prompt hook, command wrapper function, and (for fish) Enter key binding. The extension:

- MUST provide integration scripts for fish, bash, and zsh
- MUST install these scripts to an extension-owned directory on disk (e.g., within the extension's data directory)
- SHOULD leverage pi's extension installation lifecycle hooks to guide the user through setup
- SHOULD attempt shell detection (via `$SHELL`) to determine which script to install and which RC file to reference
- SHOULD emit clear instructions to the user for sourcing the script in their shell RC file (e.g., "Add `source /path/to/shell-relay.fish` to your `~/.config/fish/config.fish`")
- MAY attempt to append the source line to the appropriate RC file automatically (with user confirmation)

Each shell integration script MUST provide the following components:

**Prompt hook** (signals pane readiness):
- Be safe to source unconditionally in the user's shell RC file — the script will be loaded in *all* shell instances, not just relay sessions
- The sourced script MAY check whether `$SHELL_RELAY_SIGNAL` is defined and skip hook registration as an optimization, but this is NOT sufficient on its own
- The prompt hook itself MUST check on every invocation that `$SHELL_RELAY_SIGNAL` is defined AND that the target FIFO exists and is writable before attempting to write to it
- The hook MUST silently no-op (no error output to the terminal) if the signal channel is absent, undefined, or broken — a broken FIFO mid-session, an extension crash, or a non-relay shell instance must never pollute the user's terminal
- If the signal channel is present and valid, write `prompt_ready\n` to it on each prompt draw
- Not interfere with other prompt customizations (starship, powerlevel10k, etc.)
- Shell-specific mechanisms: fish `fish_prompt` event, bash `PROMPT_COMMAND`, zsh `precmd`

**Command wrapper function** (captures stdout/stderr/exit code):
- A function (e.g., `__relay_run`) that receives an escaped command string as `$argv[1]`, unescapes it, and wraps it in the capture pattern:
  ```
  { [unbuffer-relay -p] eval UNESCAPED_CMD | tee $STDOUT_FIFO > /dev/tty; capture exit code; } 2>&1 >/dev/null | tee $STDERR_FIFO > /dev/tty
  ```
- MUST unescape the command before `eval`: fish uses `string unescape --style=script -- $argv[1]`; bash/zsh pass `$1` directly to `eval` (already unquoted by the shell's argument parsing)
- MUST capture exit code via `$pipestatus[1]` (fish) or `${PIPESTATUS[0]}` (bash/zsh) inside the group
- MUST write `last_status:EXIT_CODE\n` to the signal FIFO
- MUST detect whether `unbuffer-relay` is available (`command -v unbuffer-relay`) and use it when present, omit when absent
- MUST run the command via `eval` in the current shell session (no forking a subprocess)
- The function reads FIFO paths from the `$SHELL_RELAY_STDOUT`, `$SHELL_RELAY_STDERR`, and `$SHELL_RELAY_SIGNAL` environment variables

**Enter key binding (fish only)** (optional, for capturing user-initiated commands):
- Override the Enter key binding to wrap user-typed commands in the capture pattern
- MUST check `commandline --is-valid` before wrapping — if the command is incomplete (unclosed brackets, quotes), insert a newline instead of executing (preserving default multiline behavior)
- MUST only wrap when `$SHELL_RELAY_SIGNAL` is defined and valid; otherwise, delegate to the default `commandline -f execute` behavior
- The wrapping is visible to the user in the pane; this MAY be mitigated via terminal title overrides

**Terminal title override (optional):**
- Fish: define a `fish_title` function that uses `status current-command` to extract and display the actual command, excluding wrapper boilerplate
- Bash/Zsh: emit raw OSC 2 escape sequences to set the terminal title to the actual command
- This is cosmetic and SHOULD NOT affect functionality

### FR-15: PTY Color Preservation (`unbuffer-relay`)

The extension MUST ship a custom expect/TCL script (`unbuffer-relay`) that wraps commands in a PTY for ANSI color preservation, with proper exit code propagation. This addresses a limitation in the standard `unbuffer` utility, which discards the child process's exit code in pipeline (`-p`) mode.

The `unbuffer-relay` script:
- MUST be functionally equivalent to `unbuffer` — wrapping a command in a PTY so that `isatty(stdout)` returns true for the wrapped command
- MUST propagate the child process's exit code in both pipeline (`-p`) and non-pipeline modes, using expect's `wait` command to capture the child's exit status
- MUST handle fast-exiting commands gracefully (wrapping `interact` and `wait` in `catch` blocks)
- MUST be installed to the extension's data directory alongside the shell integration scripts
- MUST require only `tclsh` and the `expect` package — no additional dependencies

The extension MUST detect whether `expect`/`tclsh` is available on the system (e.g., `command -v tclsh` or checking for the expect package). When available, the command wrapper function (FR-14) uses `unbuffer-relay -p` to wrap commands. When unavailable, the wrapper omits the PTY layer and commands run without color preservation for `isatty()`-checking programs.

The extension MUST support a `SHELL_RELAY_NO_UNBUFFER=1` environment variable (or equivalent configuration) to force basic mode even when `expect`/`tclsh` is available. This is useful for testing and for users who experience issues with PTY wrapping.

## Non-Functional Requirements

### NFR-1: Latency

Per-command overhead (command injection, signal channel communication) SHOULD be minimal. Persistent FIFOs eliminate per-command creation cost. No strict latency requirement is specified; if latency proves problematic during implementation, a concrete target will be established based on profiling.

### NFR-2: Output Size

Output captured via FIFOs is unbounded — FIFOs do not have the scrollback buffer limitation of `dump-screen`. The extension SHOULD truncate captured output exceeding a configurable limit before returning it to the agent, defaulting to 50KB (matching the built-in `bash` tool's truncation behavior). `dump-screen` (used for visual inspection via FR-6) IS bounded by the multiplexer's scrollback buffer.

### NFR-3: Error Resilience

- The extension MUST NOT crash if the multiplexer pane becomes unavailable mid-command
- The extension MUST NOT leave orphaned FIFOs on failure (persistent FIFOs MUST be cleaned up on shutdown, crash recovery, or stale detection on startup)
- The extension MUST handle FIFO disconnection gracefully (e.g., FIFO broken by crash — re-create and re-open)
- The extension SHOULD detect if Zellij is not running and return a clear error
- The shell integration scripts MUST silently no-op if the signal FIFO is broken (see FR-14)
- The extension SHOULD verify signal channel liveness before command injection by checking that the target pane has a live shell process (e.g., via `zellij action list-clients` or equivalent pane process state query). This is preferred over timeout-based liveness checks, which cannot distinguish a broken signal channel from a user who is idle/AFK.
- The extension SHOULD perform a startup validation on relay connect — inject a no-op command (e.g., `true`) and verify that `last_status` and `prompt_ready` signals are received, confirming the full pipeline (shell integration → signal FIFO → Node.js listener) is functional

### NFR-4: Portability

- The extension MUST work on macOS and Linux
- FIFO operations use standard POSIX `mkfifo` (universally available)
- The extension MUST work with Node.js built-in modules (`fs`, `net`, `child_process`) — no native addons
- `unbuffer-relay` requires `tclsh` + expect package (optional enhancement, not a hard dependency)
- The capture pattern uses only standard POSIX shell features (`tee`, `/dev/tty`, fd redirection) plus shell-specific constructs for the wrapper function

---

# Work Plan

See [shell-relay-workplan.md](./shell-relay-workplan.md) for the full work plan.

## Resolved Decisions

Decisions made during PRD review, captured for context:

1. **Multiple panes:** v1 targets a single configured pane. Multi-pane support is future work.

2. **Command history:** Injected commands SHOULD be prefixed with a space (` __relay_run '...'`) to exclude them from shell history. Fish's default behavior matches `HISTCONTROL=ignoreboth` (ignores space-prefixed and duplicate commands). Bash and zsh support this via `HISTCONTROL=ignorespace` and `setopt HIST_IGNORE_SPACE` respectively.

3. **User command capture (bash/zsh):** Fish is the MVP for user command capture via Enter key binding. Zsh is the next target (via `zle` widget override). Bash is deferred. Bash/zsh user commands use `dump-screen` fallback in v1.

4. **Signal channel extensibility:** The line-delimited text protocol supports adding new event types trivially. No additional events beyond `last_status` and `prompt_ready` in v1. Candidates for future: `cwd_changed:PATH`, `env_updated:VAR=VALUE`.

5. **FIFO path stability:** Deterministic paths based on session ID. This allows shell integration scripts to continue pointing at the correct FIFOs if the extension crashes and restarts, without needing to re-export environment variables into the pane.

## Future Work

- tmux multiplexer support via adapter interface
- Multiple pane targeting (per-project panes)
- Zsh user command capture via `zle` widget override
- Bash user command capture via DEBUG trap / readline binding
- Additional signal channel event types (`cwd_changed`, `env_updated`, etc.)
