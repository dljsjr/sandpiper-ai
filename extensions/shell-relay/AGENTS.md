# Shell Relay Extension — Development Guidelines

This document supplements the [repo-wide AGENTS.md](../../AGENTS.md) with shell-relay-specific guidance.

## Architecture

### Framework-Independent Core

All core logic lives in framework-independent modules under `src/`. Only `index.ts` imports pi framework APIs. Shell integration scripts live in `shell-integration/`. The extension loads from `src/index.ts` via the package-local `pi.extensions` entry; `postinstall.sh` copies the source tree and assets into `dist/extensions/shell-relay/`.

| Module | Purpose | Pi imports? |
|--------|---------|-------------|
| `env-export.ts` | Shell-appropriate env var export command generation | No |
| `escape.ts` | Command escaping (fish quote-break / bash `printf '%q'`) | No |
| `fifo.ts` | Persistent FIFO lifecycle (O_RDWR sentinel pattern) — used for signal FIFO only | No |
| `signal.ts` | Signal channel parser (line-delimited protocol) | No |
| `snapshot-diff.ts` | Output capture via dump-screen before/after diffing | No |
| `zellij.ts` | Zellij 0.44+ CLI wrapper (paste, send-keys, --session, --pane-id, list-panes) | No |
| `ansi.ts` | Strip terminal query/response sequences from output | No |
| `preflight.ts` | Shell integration preflight check (probes for `__relay_prompt_hook`) | No (imports from `sandpiper-ai-core`) |
| `index.ts` | Pi extension glue (tool registration, lifecycle, preflight registration) | **Yes** — only file |

### Legacy Modules (Pending Removal)

These modules are still in the codebase but no longer used by the rewritten relay:

| Module | Status |
|--------|--------|
| `ghost-client.ts` | Eliminated — Zellij 0.44 --pane-id targeting works without ghost client |
| `relay.ts` | Replaced by executeCommand() in index.ts with snapshot-diff |

### Zellij 0.44 API Usage

The relay uses Zellij 0.44+ CLI features exclusively:

- **Session creation:** `zellij attach --create` spawned via background process, then `zellij action detach` — inherits terminal dimensions for wide viewport
- **Command injection:** `paste` (bracketed paste mode) + `send-keys "Enter"` — replaces `write-chars`
- **Session targeting:** `--session <name>` flag — replaces `ZELLIJ_SESSION_NAME` env var
- **Pane targeting:** `--pane-id terminal_N` flag — eliminates need for ghost client
- **Pane discovery:** `list-panes --json` — replaces dump-screen-to-dev-null polling
- **Output capture:** `dump-screen --full` before/after command, diffed in TypeScript

### Signal Protocol

Line-delimited text on the signal FIFO (the only FIFO used):
- `last_status:N\n` — command completed with exit code N
- `prompt_ready\n` — pane is at shell prompt

### Output Capture: Snapshot-Diff

Output is captured by taking `dump-screen --full` snapshots before and after command execution, then diffing in TypeScript. The injected command text (`__relay_run 'escaped cmd'`) serves as a unique marker — the diff splits on it and takes everything after, trimming the trailing prompt.

Key considerations:
- Join lines without separator to find the marker (handles viewport wrapping)
- Map marker position back to original lines to preserve line structure
- Prompt trimming uses Set-based matching against the before snapshot's prompt lines
- Viewport sizing matters — use attach-then-detach (not --create-background) for wide viewports

### Shell Integration Scripts

Shell scripts in `shell-integration/` are sourced in users' shell RC files. They must be:
- Safe to source in ALL shell instances (not just relay sessions)
- Silent no-op when `$SHELL_RELAY_SIGNAL` is absent/broken
- Defensive on every hook invocation (not just at source time)
- Compatible with other prompt customizations (starship, powerlevel10k, etc.)

Currently the scripts still reference `SHELL_RELAY_STDOUT`, `SHELL_RELAY_STDERR`, and `SHELL_RELAY_UNBUFFER` — these are set to `/dev/null` as a compatibility shim. A future simplification pass should remove these requirements.

## Testing

### Snapshot-Diff Tests
- Test with various prompt styles (custom, multi-line, simple `$ `)
- Test wrapped command echoes (narrow viewport simulation)
- Test output with blank lines, error messages, special characters
- Test the "extreme wrapping" case where output starts on the same line as the command echo (currently a known limitation)

### Zellij Tests
- Mock `child_process.execSync` — tests should NOT depend on a running Zellij instance
- When mocking `execSync` with `encoding: "utf-8"`, return `string` values cast as `never`

### FIFO Tests
- Use **real FIFOs** (`mkfifo`), not mocks — the O_RDWR sentinel pattern must be validated against real kernel behavior
- Always clean up FIFOs in `afterEach`

### Escape Tests
- Round-trip tests invoke real `fish` shell (~400ms per test)
- Pass commands via environment variables or stdin

## Key Patterns

### Viewport Sizing
`--create-background` produces a 50x49 viewport. Use `zellij attach --create` (spawned as a child process) which inherits terminal dimensions, then detach. The session retains the wide viewport.

### Command Escaping
- **Fish:** Quote-break pattern (`'text'"'"'more'`)
- **Bash/Zsh:** `printf '%q'` via env var → round-trips through `eval`
- Space-prefix the injection (` __relay_run ESCAPED`) to exclude from shell history

### Command Serialization
The relay uses a promise chain to serialize concurrent `execute()` calls. Only one command runs in the pane at a time.

## Reference Documentation

- [Zellij 0.44 Design Notes](../../.sandpiper/docs/zellij-044-relay-design.md) — architecture decisions, API findings
- [Background Process Framework](../../.sandpiper/docs/background-process-framework-design.md) — ProcessManager design
- [Task Board](../../.sandpiper/tasks/SHR/) — individual work items
