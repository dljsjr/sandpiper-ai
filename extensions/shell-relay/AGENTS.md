# Shell Relay Extension — Development Guidelines

This document supplements the [repo-wide AGENTS.md](../../AGENTS.md) with shell-relay-specific guidance.

## Architecture

### Framework-Independent Core

All core logic lives in framework-independent modules. Only `index.ts` imports pi framework APIs.

| Module | Purpose | Pi imports? |
|--------|---------|-------------|
| `ansi.ts` | Strip terminal query/response sequences from PTY output | No |
| `env-export.ts` | Shell-appropriate env var export command generation | No |
| `fifo.ts` | Persistent FIFO lifecycle (O_RDWR sentinel pattern) | No |
| `ghost-client.ts` | Headless Zellij client management (expect-based PTY) | No |
| `signal.ts` | Signal channel parser (line-delimited protocol) | No |
| `zellij.ts` | Zellij CLI wrapper | No |
| `escape.ts` | Command escaping (`string escape` / `printf '%q'`) | No |
| `relay.ts` | Orchestration (ties all modules together) | No |
| `index.ts` | Pi extension glue (tool registration, lifecycle) | **Yes** — only file |

### Shell Integration Scripts

Shell scripts in `shell-integration/` are sourced in users' shell RC files. They must be:
- Safe to source in ALL shell instances (not just relay sessions)
- Silent no-op when `$SHELL_RELAY_SIGNAL` is absent/broken
- Defensive on every hook invocation (not just at source time)
- Compatible with other prompt customizations (starship, powerlevel10k, etc.)

## Testing

### FIFO Tests
- Use **real FIFOs** (`mkfifo`), not mocks — the O_RDWR sentinel pattern must be validated against real kernel behavior
- Must call `fifoManager.open()` BEFORE creating read streams (otherwise blocks on FIFO open)
- Large FIFO writes in tests MUST use child processes (not `setTimeout`) to avoid event loop deadlock
- Always clean up FIFOs in `afterEach` — leaked FIFOs cause subsequent tests to hang

### Zellij Tests
- Mock `child_process.execSync` — tests should NOT depend on a running Zellij instance
- When mocking `execSync` with `encoding: "utf-8"`, return `string` values cast as `never` (TypeScript strict mode requires this)

### Escape Tests
- Round-trip tests invoke real `fish` shell — they verify our escaping matches fish's own `string unescape`
- Pass commands via environment variables or stdin to avoid shell interpretation by the parent process
- Each escape test spawns a fish process (~400ms per test) — these are inherently slow

### Signal Channel Tests
- Pure unit tests — no external dependencies, fast
- Test chunked input (data split across multiple `feed()` calls)
- Test `waitFor()` timeout behavior

## Key Patterns

### O_RDWR Sentinel for Persistent FIFOs
Open FIFOs with `O_RDWR` so the fd acts as both reader and writer. This prevents EOF when external writers close. The fd must be opened BEFORE creating read streams.

### Signal Protocol
Line-delimited text on the signal FIFO:
- `last_status:N\n` — command completed with exit code N (written by `__relay_run`)
- `prompt_ready\n` — pane is at shell prompt (written by prompt hook)

Separate `last_status` from `prompt_ready` — a command may complete before the prompt is drawn.

### Ghost Client for Headless Zellij
Zellij silently drops `write-chars` and breaks `dump-screen` on background sessions with no attached client. The ghost client (`ghost-attach` expect script) spawns a headless Zellij client with a real PTY, giving Zellij a focused pane. This makes `write-chars` and `dump-screen` work reliably. The user can optionally attach too (multi-client) for observation.

**Setup sequence:** Ghost client spawns → shell starts → config sources relay integration → extension creates FIFOs + starts listening → injects env exports → waits for `prompt_ready` → setup complete. The `prompt_ready` signal replaces arbitrary timeouts — it confirms the shell is initialized, env vars are set, and the FIFO pipeline is wired up.

### Enhanced Mode (PTY Color Preservation)
The `eval` prefix approach puts `unbuffer-relay` before the command being eval'd:
```fish
eval $SHELL_RELAY_UNBUFFER $cmd | tee $SHELL_RELAY_STDOUT > /dev/tty
```
This preserves session state (`eval` runs in the current shell) while getting PTY colors (`unbuffer-relay` spawns the first binary in a PTY). For pipelines, only the first command gets the PTY. Shell builtins as the first token will fail in unbuffer-relay (they aren't binaries) — but builtins don't produce colored output, so this is harmless. Do NOT use the `-p` (pipeline) flag — it blocks reading stdin from the terminal.

### Command Escaping
- **Fish:** `string escape --style=script` via stdin → round-trips through `eval (string unescape ...)`
- **Bash/Zsh:** `printf '%q'` via env var → round-trips through `eval`
- Space-prefix the injection (` __relay_run ESCAPED`) to exclude from shell history

### Fish Enter Keybind
- Binds unconditionally (not gated on `$SHELL_RELAY_SIGNAL`) because env vars are exported after shell startup
- `__relay_execute` guards on every invocation — falls back to `commandline -f execute` when relay is inactive
- Detects agent-injected commands (`__relay_run` prefix) and executes directly without re-wrapping

### Command Serialization
Relay uses a promise chain to serialize concurrent `execute()` calls. Only one command runs in the pane at a time.

## Reference Documentation

- [PRD](../../.sandpiper/docs/shell-relay-prd.md) — requirements and design decisions
- [Work Plan](../../.sandpiper/docs/shell-relay-workplan.md) — phased implementation plan
- [Task Board](../../.sandpiper/tasks/SHR/) — individual work items
