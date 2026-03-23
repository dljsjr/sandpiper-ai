# Shell Relay

A pi extension that gives the coding agent access to a persistent, shared terminal session. Both the user and agent can observe and interact with the session in real time — like a Google Doc, but for a shell.

## What It Does

Shell Relay registers two tools for the agent:

- **`shell_relay`** — Execute commands in the user's shared terminal (Zellij pane)
- **`shell_relay_inspect`** — View the current visual state of the shared terminal

Commands run in the user's existing shell session, inheriting all session state: environment variables, shell functions, authentication tokens, activated virtual environments, and more.

### When to Use Shell Relay vs `bash`

| Use Shell Relay when… | Use `bash` when… |
|------------------------|-------------------|
| Command needs session state (auth tokens, shell functions, non-exported vars) | General-purpose commands with no session state dependency |
| You want the user to see command execution in real time | Speed matters — `bash` is faster (no Zellij overhead) |
| You need 1Password or other per-process-tree auth to persist | The command is simple and ephemeral |
| You want to inspect what the user has been doing in their terminal | |

## Requirements

- **[Zellij](https://zellij.dev)** terminal multiplexer
- **Shell integration** sourced in your shell RC file (see [Setup](#setup))
- **Optional:** `tclsh` + `expect` package for ANSI color preservation (enhanced mode)

## Setup

### 1. Install the Pi Package

This extension is part of the `sandpiper-ai` pi package. If you have the package installed, the extension is auto-discovered.

### 2. Source the Shell Integration

Add the appropriate source line to your shell's RC file:

**Fish** (`~/.config/fish/config.fish`):
```fish
source /path/to/extensions/shell-relay/shell-integration/relay.fish
```

**Bash** (`~/.bashrc`):
```bash
source /path/to/extensions/shell-relay/shell-integration/relay.bash
```

**Zsh** (`~/.zshrc`):
```zsh
source /path/to/extensions/shell-relay/shell-integration/relay.zsh
```

The integration scripts are safe to source in all shell instances — they silently no-op when not in a relay session.

### 3. Start a Zellij Session

Shell Relay can create a session for you, or you can connect to an existing one.

**Automatic:** The extension creates a session on first tool use if no session is configured.

**Manual:** Set the `SHELL_RELAY_SESSION` environment variable before starting pi:
```sh
export SHELL_RELAY_SESSION=my-session
```

Then attach to that session in another terminal:
```sh
zellij attach my-session
```

## Configuration

### Environment Variables

| Variable | Description |
|----------|-------------|
| `SHELL_RELAY_SESSION` | Zellij session name to connect to |
| `SHELL_RELAY_PANE_ID` | Specific pane ID within the session |
| `SHELL_RELAY_NO_UNBUFFER` | Set to `1` to force basic mode (no PTY color preservation) |

### Capture Modes

| Mode | Colors | Requires |
|------|--------|----------|
| **Enhanced** | ✅ Full ANSI preserved | `tclsh` + `expect` |
| **Basic** | ⚠️ Programs using `isatty()` lose color | Nothing extra |

The extension auto-detects whether `tclsh`/`expect` is available and selects the appropriate mode. Set `SHELL_RELAY_NO_UNBUFFER=1` to force basic mode.

## Shell Integration Details

### What Gets Installed

Each shell integration script provides:

1. **Prompt hook** — Writes `prompt_ready` to the signal FIFO when the shell prompt is drawn, telling the extension the pane is ready for commands.

2. **Command wrapper** (`__relay_run`) — Wraps agent commands in a capture pattern that separates stdout/stderr via FIFOs while displaying output in the terminal via `/dev/tty`.

3. **Enter key binding** (fish only) — Wraps user-typed commands in the same capture pattern, so the agent can see output from commands the user runs.

### Safety Guarantees

- Scripts are safe to source in **all** shell instances, not just relay sessions
- Every hook invocation checks that `$SHELL_RELAY_SIGNAL` exists and is writable
- If the signal FIFO is absent, broken, or the extension has crashed, hooks silently no-op
- No error output is ever written to the terminal from the integration scripts
- Compatible with other prompt customizations (starship, powerlevel10k, etc.)

## Architecture

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
└──────────────────────┘                      └─────────────────────────────┘
```

### Key Design Decisions

- **Persistent FIFOs** with `O_RDWR` sentinel handles — created once per session, no per-command lifecycle
- **Signal channel** for event-driven completion detection — no polling
- **`tee` + `/dev/tty`** — output goes to both the agent (via FIFO) and the user (via terminal)
- **Command serialization** — only one command runs in the pane at a time
- **`unbuffer-relay`** — custom expect script for PTY color preservation with proper exit code propagation

## Troubleshooting

### "Startup validation failed"
The extension couldn't verify the full pipeline works. Check that:
1. The shell integration script is sourced in the target pane
2. The FIFO environment variables (`$SHELL_RELAY_SIGNAL`, etc.) are set in the pane
3. Try running `echo prompt_ready > $SHELL_RELAY_SIGNAL` manually in the pane

### "Zellij is not installed or not available"
Install Zellij from https://zellij.dev

### Commands lose color
Install `expect` for enhanced mode:
- macOS: `brew install expect` (usually pre-installed)
- Ubuntu/Debian: `apt install expect`
- Check: `command -v tclsh && echo "available"`

### Agent errors suggest using `bash` instead
The relay pane may be unavailable. Check that the Zellij session is running and the pane hasn't been closed.
