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
- **`expect`/`tclsh`** — required for the ghost client and enhanced color mode (pre-installed on macOS; `apt install expect` on Linux)
- **Shell integration** sourced in your shell RC file (see [Setup](#setup))

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

The integration scripts are safe to source in all shell instances — they silently no-op when not in a relay session. Enter key bindings (fish) are registered unconditionally but guard on every invocation.

### 3. Using the Relay

Shell Relay sets up automatically on first tool use:

1. **Auto-create:** If no session is configured, the extension creates a new Zellij session with a ghost client (headless PTY) and reports the session name.
2. **Existing session:** Set `SHELL_RELAY_SESSION` or pass the `session` parameter on the tool call.
3. **Interactive:** Use `/relay-connect` to pick from existing Zellij sessions or create a new one.

The user can optionally attach to the session to observe commands in real time:
```sh
zellij attach <session-name>
```
This is **optional** — the relay works fully without user attachment thanks to the ghost client.

### Commands

| Command | Description |
|---------|-------------|
| `/relay-connect` | Interactive session picker — select existing or create new |
| `/relay-status` | Show connection state, shell type, capture mode, FIFO paths |

## Configuration

### Environment Variables

| Variable | Description |
|----------|-------------|
| `SHELL_RELAY_SESSION` | Zellij session name to connect to |
| `SHELL_RELAY_PANE_ID` | Specific pane ID within the session |
| `SHELL_RELAY_NO_UNBUFFER` | Set to `1` to force basic mode (no PTY color preservation) |

### Capture Modes

| Mode | Colors | How it works |
|------|--------|--------------|
| **Enhanced** | ✅ Full ANSI preserved | `unbuffer-relay` prefixed via `eval` — first command in pipeline gets a PTY, session state preserved |
| **Basic** | ⚠️ Programs using `isatty()` lose color | Direct `eval` in current shell — no PTY |

The extension auto-detects whether `tclsh` is available and selects the appropriate mode. Set `SHELL_RELAY_NO_UNBUFFER=1` to force basic mode.

**Note:** In enhanced mode, if the first token of a command is a shell builtin (e.g., `set`, `cd`), `unbuffer-relay` will fail to spawn it (builtins aren't binaries). This is harmless — builtins don't produce colored output. The command still executes via `eval` in the current shell.

## How It Works

### Ghost Client

Zellij requires a real PTY client for `write-chars` and `dump-screen` to work reliably — background sessions silently drop input. Shell Relay spawns a **ghost client** using `expect` that attaches to the session with a real PTY, keeping it alive invisibly. The user can attach as a second client to observe.

### Startup Sequence

1. Ghost client spawns → Zellij session created → shell starts → config sources integration script
2. Extension creates persistent FIFOs and starts listening on the signal channel
3. Extension injects FIFO path env vars via `write-chars`
4. Shell processes exports → prompt draws → prompt hook writes `prompt_ready` to signal FIFO
5. Extension receives `prompt_ready` → setup confirmed, ready for commands

The `prompt_ready` signal replaces arbitrary timeouts — it proves the shell initialized, env vars are set, and the FIFO pipeline is wired up.

### Architecture

```
┌──────────────────────┐                      ┌─────────────────────────────┐
│  pi extension        │   write-chars        │  zellij pane                │
│  (shell_relay tool)  │ ────────────────────► │  (user's shell session)     │
│                      │                      │                             │
│                      │   stdout FIFO        │  command wrapper:           │
│                      │ ◄──── (persistent) ──│  { [unbuffer-relay]         │
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
│  ghost client ───────│── expect PTY ────────│── keeps pane focused        │
└──────────────────────┘                      └─────────────────────────────┘
```

### Key Design Decisions

- **Ghost client** — expect-based headless PTY so `write-chars` and `dump-screen` work without user attachment
- **Persistent FIFOs** with `O_RDWR` sentinel handles — created once per session, no per-command lifecycle
- **Signal channel** for event-driven completion detection — no polling
- **`prompt_ready`** for setup confirmation — replaces arbitrary timeouts
- **`tee` + `/dev/tty`** — output goes to both the agent (via FIFO) and the user (via terminal)
- **Command serialization** — only one command runs in the pane at a time
- **`eval` prefix for enhanced mode** — `eval unbuffer-relay CMD` preserves session state while getting PTY colors
- **`unbuffer-relay`** — custom expect script for PTY wrapping with proper exit code propagation

## Troubleshooting

### "Timed out waiting for prompt_ready signal"
The extension created the session but the shell integration didn't fire. Check that:
1. The shell integration script is sourced in your shell's RC file (e.g., `config.fish`)
2. `expect`/`tclsh` is installed (required for the ghost client)
3. Check: `command -v tclsh && echo "available"`

### "No Zellij session configured"
No session was specified and auto-creation wasn't attempted. Either:
- Set `SHELL_RELAY_SESSION` environment variable
- Pass the `session` parameter on the tool call
- Use `/relay-connect` to select a session interactively

### "Zellij is not installed or not available"
Install Zellij from https://zellij.dev

### Commands lose color
Check enhanced mode is active:
- `tclsh` must be on PATH
- `SHELL_RELAY_NO_UNBUFFER` must not be set
- `/relay-status` shows the current capture mode

### Agent errors suggest using `bash` instead
The relay pane may be unavailable. Check that the Zellij session is running and the ghost client process hasn't been killed.
