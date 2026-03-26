# Shell Relay Extension — Development Guidelines

This document supplements the [repo-wide AGENTS.md](../../AGENTS.md) with shell-relay-specific guidance.

## Architecture

### Framework-Independent Core

All core logic lives in framework-independent modules under `src/`. Only `index.ts` imports pi framework APIs. Companion scripts (`ghost-attach`, `unbuffer-relay`) and shell integration scripts live at the extension root. The bundle is built to `dist/shell-relay`.

| Module | Purpose | Pi imports? |
|--------|---------|-------------|
| `ansi.ts` | Strip terminal query/response sequences from PTY output | No |
| `env-export.ts` | Shell-appropriate env var export command generation | No |
| `fifo.ts` | Persistent FIFO lifecycle (O_RDWR sentinel pattern) | No |
| `ghost-client.ts` | Headless Zellij client management (expect-based PTY) | No |
| `signal.ts` | Signal channel parser (line-delimited protocol) | No |
| `zellij.ts` | Zellij CLI wrapper | No |
| `escape.ts` | Command escaping (fish quote-break / bash `printf '%q'`) | No |
| `preflight.ts` | Shell integration preflight check (probes shell for `__relay_prompt_hook`) | No (imports from `sandpiper-ai-core`) |
| `relay.ts` | Orchestration (ties all modules together) | No |
| `index.ts` | Pi extension glue (tool registration, lifecycle, preflight registration) | **Yes** — only file |

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
- **Fish:** Quote-break pattern (`'text'"'"'more'`) — fish single quotes have NO escape sequences, so single quotes are embedded by ending the quote, inserting `"'"`, and re-opening
- **Bash/Zsh:** `printf '%q'` via env var → round-trips through `eval`
- Space-prefix the injection (` __relay_run ESCAPED`) to exclude from shell history

### Fish User Command Capture (fish_preexec)
- Uses `fish_preexec` event to dynamically create wrapper functions that shadow external commands
- Fish resolves command names AFTER preexec handlers complete, so wrappers take effect for the current execution
- Three cases: builtins (skipped), existing functions (copied via `functions -c`), external binaries (wrapped with `command` prefix)
- `--wraps` preserves tab completion transitively
- Pipeline optimization: `test -t 1` skips unbuffer-relay for non-head commands

### Command Serialization
Relay uses a promise chain to serialize concurrent `execute()` calls. Only one command runs in the pane at a time.

### Shell Integration Installation & Preflight
Shell integration scripts are installed to `~/.sandpiper/shell-integrations/` via `sandpiper --install-shell-integrations`. At session start, the preflight system probes whether the integration is actually sourced by checking for `__relay_prompt_hook` in the user's shell:
- **Fish:** `fish -i -c 'functions -q __relay_prompt_hook'`
- **Bash:** `bash -i -c 'type __relay_prompt_hook > /dev/null 2>&1'`
- **Zsh:** `zsh -i -c 'whence __relay_prompt_hook > /dev/null 2>&1'`

All probes use `-i` (interactive mode) because integration scripts are typically guarded behind `status is-interactive` or equivalent checks. Without `-i`, the source line is skipped and the function appears undefined.

Falls back to file existence check at the well-known location for unrecognized shells.

## Reference Documentation

- [PRD](../../.sandpiper/docs/shell-relay-prd.md) — requirements and design decisions
- [Work Plan](../../.sandpiper/docs/shell-relay-workplan.md) — phased implementation plan
- [Task Board](../../.sandpiper/tasks/SHR/) — individual work items
