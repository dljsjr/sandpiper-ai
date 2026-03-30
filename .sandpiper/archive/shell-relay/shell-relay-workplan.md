# Shell Relay — Work Plan

> **Historical implementation plan — superseded in part.** This work plan tracks an earlier relay architecture and should be read as historical execution context, not the current implementation plan.
>
> Current references:
> - `extensions/shell-relay/README.md`
> - `extensions/shell-relay/AGENTS.md`
> - `.sandpiper/docs/zellij-044-relay-design.md`
>
> **PRD:** [shell-relay-prd.md](./shell-relay-prd.md)
> **Extension path:** `extensions/shell-relay/`

## Phase 1: Shell Integration & `unbuffer-relay` (Day 1, ~3-4 hours)

### 1.1 Shell Integration Scripts

Write shell integration scripts per FR-14. Fish is the MVP with full functionality; bash and zsh get prompt hook and wrapper function only (user command capture is deferred — see Future Work in PRD).

**Deliverables:**
- `shell-integration/relay.fish` — Fish integration (full):
  - `fish_prompt` event handler (writes `prompt_ready` to signal FIFO)
  - `__relay_run` wrapper function (capture pattern with `tee` + FIFOs + exit code)
  - Enter key binding override (`bind \r` / `bind \n`) with `commandline --is-valid` multiline check
  - `fish_title` override to display clean command in terminal title
- `shell-integration/relay.bash` — Bash integration (prompt hook + wrapper only):
  - `PROMPT_COMMAND` hook (writes `prompt_ready`)
  - `__relay_run` wrapper function
- `shell-integration/relay.zsh` — Zsh integration (prompt hook + wrapper only):
  - `precmd` hook (writes `prompt_ready`)
  - `__relay_run` wrapper function

All scripts implement FR-14: safe to source unconditionally, guards on every hook invocation, silent no-op when signal channel is absent/broken. Injected commands use space prefix for history exclusion (see FR-3).

### 1.2 `unbuffer-relay` Script

Write the custom expect/TCL script per FR-15.

**Deliverables:**
- `unbuffer-relay` — ~25 line expect script for PTY color preservation with exit code propagation
- Supports both pipeline (`-p`) and non-pipeline modes
- `catch`-wrapped `interact` and `wait` for fast-exiting command resilience

> **Note:** A working prototype was built during the design phase (see `shell-relay-session-context.jsonl` for details). This task formalizes it into the extension directory.

### 1.3 Validation

- Test capture pattern manually in fish in an interactive Zellij shell
- Verify stdout/stderr separation, exit code accuracy, color preservation
- Verify persistent FIFO reuse across multiple commands
- Verify fish Enter key binding with multiline commands (`commandline --is-valid`)
- Verify `string escape`/`string unescape` round-trip with compound commands (pipes, redirections, quotes, `$` expansions)
- Bash/zsh validation is deferred to when their full implementation is done

## Phase 2: Pi Extension & Tools (Day 1-2, ~4-5 hours)

### 2.1 Extension Scaffolding

Create the extension directory structure:

```
extensions/shell-relay/
├── index.ts              # Extension entry point, tool registration
├── relay.ts              # Core relay orchestration logic
├── fifo.ts               # Persistent FIFO management (O_RDWR sentinel pattern)
├── zellij.ts             # Zellij CLI integration
├── shell-integration/
│   ├── relay.fish        # Fish integration (prompt hook + wrapper + keybinding)
│   ├── relay.bash        # Bash integration (prompt hook + wrapper)
│   └── relay.zsh         # Zsh integration (prompt hook + wrapper)
├── unbuffer-relay        # Custom expect script for PTY + exit code
└── package.json          # Package metadata
```

### 2.2 Persistent FIFO Manager (`fifo.ts`)

Implement the persistent FIFO lifecycle per FR-4:
- Deterministic FIFO paths based on relay session ID (e.g., `$XDG_RUNTIME_DIR/shell-relay/<session-id>/{stdout,stderr,signal}`)
- Create three FIFOs at session start via `execSync('mkfifo ...')` with mode `0600` in a `0700` directory (FR-11)
- Open each with `O_RDWR` for sentinel behavior (no EOF between commands)
- Create `ReadStream` for each, with line-delimited parsing for the signal channel
- Event emitter interface for `last_status` and `prompt_ready` signals
- Cleanup on shutdown, stale FIFO detection on startup

### 2.3 Relay Orchestration (`relay.ts`)

Implement the core execution flow:

1. Acquire execution lock (serialize concurrent calls) — FR-12
2. Confirm `prompt_ready` signal received (pane is at prompt) — FR-8
3. Construct wrapped command (invoke `__relay_run` with the user's command) — FR-3
4. Inject via `zellij action write-chars` — FR-7
5. Read stdout and stderr from FIFOs as data arrives — FR-4
6. Wait for `last_status:EXIT_CODE` on signal channel — command done — FR-9
7. Wait for `prompt_ready` on signal channel — pane ready — FR-9
8. Return structured result (stdout, stderr, exit code) to agent

### 2.4 Zellij Integration (`zellij.ts`)

Implement the Zellij CLI wrapper:
- Command injection (`write-chars`)
- Pane content inspection (`dump-screen --full` to FIFO) — for FR-6 visual inspection
- Session/pane creation and targeting (`attach --create-background`, `action new-pane`) — FR-10
- Pane process state queries (`list-clients` or equivalent) — FR-8
- Session targeting via `ZELLIJ_SESSION_NAME` environment variable
- Availability detection

### 2.5 Tool Registration (`index.ts`)

Register the `shell_relay` tool and `shell_relay_inspect` tool per FR-1 and FR-6.

### 2.6 Session/Pane Lifecycle

Implement the three input configurations from FR-10:
- No session/pane → create both via `zellij attach --create-background`, report to user
- Session, no pane → create pane via `zellij action new-pane`, report to user
- Session + pane → connect to existing

Export environment variables (`SHELL_RELAY_SIGNAL`, `SHELL_RELAY_STDOUT`, `SHELL_RELAY_STDERR`) into the pane.

### 2.7 Shell Integration Installer

On extension installation or first use:
- Detect user's shell via `$SHELL`
- Install integration scripts + `unbuffer-relay` to extension data directory
- Emit clear instructions for sourcing the appropriate script in the user's shell RC file
- Leverage pi's extension installation lifecycle hooks where available

### 2.8 Startup Validation

On relay connect, perform pipeline validation per NFR-3:
- Inject a no-op command (e.g., ` __relay_run 'true'`) into the pane
- Verify `last_status:0` and `prompt_ready` signals are received on the signal channel
- Report success/failure to the user; fail fast with actionable error if the pipeline is broken (e.g., shell integration not sourced, FIFO path mismatch)

## Phase 3: Testing & Hardening (Day 2, ~2-3 hours)

### 3.1 Unit Tests

- Shell integration scripts: verify guard behavior (missing var, broken FIFO, normal operation)
- Persistent FIFO manager: creation, O_RDWR sentinel, continuous reading, cleanup, stale detection
- Signal channel: line parsing, `last_status` / `prompt_ready` event emission
- Zellij integration: mock-based tests for CLI interactions

### 3.2 Manual Integration Testing

- Start a Zellij session with a fish pane (shell integration sourced)
- Configure the extension to target that pane
- Verify:
  - Signal channel receives `prompt_ready` on prompt draw
  - Agent commands: stdout and stderr captured separately via FIFOs
  - Agent commands: exit codes correct (including with `unbuffer-relay`)
  - Agent commands: colors preserved in stdout capture (with `unbuffer-relay`)
  - User sees commands and output in the pane in real time (via `/dev/tty`)
  - Agent can inspect pane state via `dump-screen` (FR-6)
  - User can run commands between agent commands (bidirectional)
  - FIFOs reused across multiple sequential commands (no EOF)
- Test timeout behavior (Ctrl+C injection)
- Test behavior when pane is busy (readiness detection + notification)
- Test behavior when Zellij is not running
- Test signal channel resilience (kill extension mid-command, verify no terminal pollution)
- Test without `expect`/`tclsh` (basic mode fallback) — use `SHELL_RELAY_NO_UNBUFFER=1` to force basic mode without uninstalling expect

### 3.3 Edge Cases

- Commands that produce no output
- Commands that produce only stderr
- Very large output (verify FIFO handles unbounded data)
- Rapid sequential commands (serialization correctness, FIFO reuse)
- User interacts with pane between agent commands
- Signal FIFO broken mid-session (extension crash/restart)
- Pane closed while command is running
- Multiline commands via Enter key binding (fish `commandline --is-valid`)
- Commands with special characters (quotes, pipes, semicolons, dollar signs)
- `string escape`/`string unescape` round-trip with adversarial inputs: nested quotes, mixed single/double quotes, backticks, `$()` subcommands, newlines, empty strings, unicode

## Phase 4: Polish & Ergonomics (Day 2-3, ~2 hours)

### 4.1 Configuration UX

- `/relay-config` command to interactively select or create target session/pane
- Persist configuration across sessions via `pi.appendEntry()`
- Auto-detect Zellij via `$ZELLIJ_SESSION_NAME` environment variable

### 4.2 Session Start Hook

On `session_start`:
- Check if Zellij is running
- Check if the target pane is configured and reachable
- Detect `expect`/`tclsh` availability, report enhanced vs. basic mode
- Notify the user of relay status via `ctx.ui.setStatus()` or `ctx.ui.notify()`

### 4.3 Shell Integration Installer (Stretch)

If not completed as part of Phase 2, enhance the installer with:
- Optionally append source line to RC file automatically (with user confirmation)
- Support for detecting and configuring multiple shells

### 4.4 Documentation

- README for the extension with setup instructions
- Document shell integration setup per shell
- Document Zellij session/pane configuration options
- Document enhanced vs. basic mode (with/without `expect`)
- Agent guidance (when to use `shell_relay` vs `bash`) is handled via `promptSnippet` and `promptGuidelines` on the tool registration (FR-1), not a separate skill file

### 4.5 Graceful Degradation

When the relay is unavailable (Zellij not running, pane not configured, shell integration not set up):
- Return a clear, actionable error message
- Suggest specific remediation steps
- Suggest falling back to `bash` for commands that don't need session state

## Estimated Total Effort

| Phase | Effort | Priority |
|-------|--------|----------|
| Phase 1: Shell Integration & `unbuffer-relay` | ~3-4 hours | P0 |
| Phase 2: Pi Extension & Tools | ~4-5 hours | P0 |
| Phase 3: Testing & Hardening | ~2-3 hours | P0 |
| Phase 4: Polish & Ergonomics | ~2 hours | P1 |
| **Total** | **~11-14 hours** | |
