# Shell Relay

A Sandpiper extension that lets the agent execute commands in a shared Zellij terminal session instead of a fresh forked shell.

Both the user and the agent can see and interact with the same terminal pane in real time. This is the right tool when a command depends on live shell session state such as:

- authenticated CLI state
- shell functions
- non-exported environment variables
- activated virtual environments
- anything the built-in `bash` tool would lose by starting a new process tree

## Tools

Shell Relay registers two tools:

- **`shell_relay`** — run a command in the shared terminal session
- **`shell_relay_inspect`** — inspect the current visual state of the pane

Examples:

```text
shell_relay: op run -- kubectl get pods
shell_relay: source env.sh && make deploy
shell_relay_inspect
```

## Requirements

- **[Zellij](https://zellij.dev)**
- **Zellij 0.44+** for `--session`, `--pane-id`, `list-panes --json`, `paste`, and current `dump-screen` behavior
- **Shell integration** sourced in your shell config

No `expect`, `tclsh`, ghost client, or extension bundle is required.

## Setup

### 1. Install shell integrations

Install the relay shell integration files:

```bash
sandpiper --install-shell-integrations
```

Then source the appropriate file from your shell config:

**Fish** (`~/.config/fish/config.fish`)
```fish
source ~/.sandpiper/shell-integrations/relay.fish
```

**Bash** (`~/.bashrc`)
```bash
source ~/.sandpiper/shell-integrations/relay.bash
```

**Zsh** (`~/.zshrc`)
```zsh
source ~/.sandpiper/shell-integrations/relay.zsh
```

The scripts are safe to source unconditionally. Outside a relay session they silently no-op.

### 2. Start using the relay

Shell Relay is lazy-initialized on first use.

It chooses a Zellij session in this order:

1. the `session` parameter passed to the tool
2. `SHELL_RELAY_SESSION`
3. a new auto-generated session name like `relay-<id>`

You can also connect interactively with:

```text
/relay-connect
```

And inspect the current connection with:

```text
/relay-status
```

To watch the shared terminal directly, attach to the session:

```bash
zellij attach <session-name>
```

## How it works

### Session model

On first use, Shell Relay creates or connects to a Zellij session, finds a terminal pane, exports relay environment variables into that shell, and waits for a `prompt_ready` signal from the shell integration.

The relay session is collaborative:

- the agent can run commands there
- the user can attach and watch
- the user may also type in the pane between agent commands

### Command injection

Commands are injected with:

- `zellij action paste ...`
- `zellij action send-keys Enter`

This replaced the older `write-chars` approach.

### Output capture

Shell Relay no longer captures stdout/stderr through dedicated FIFOs.

Instead it:

1. takes a **before** snapshot with `dump-screen --full`
2. runs the command in the pane
3. waits for shell integration signals (`last_status`, then usually `prompt_ready`)
4. takes an **after** snapshot
5. diffs the two snapshots in TypeScript to extract the new output

This means:

- output is captured from the pane's rendered text
- stdout/stderr are **not** returned as separate structured streams
- interactive TUIs are best examined with `shell_relay_inspect`

### Shell integration

The shell integration provides the synchronization signals that make the relay reliable:

- `prompt_ready` — the shell is at a prompt and ready
- `last_status:N` — the last injected relay command exited with status `N`

The extension uses a signal FIFO for these events. Output itself is not piped through the shell integration.

## Current architecture

```text
┌──────────────────────┐                      ┌─────────────────────────────┐
│ shell_relay tool     │                      │ Zellij terminal pane        │
│                      │ paste + send-keys ─► │ user's shell session        │
│                      │                      │                             │
│ dump-screen before   │ ◄──────────────────► │ visible terminal content    │
│ dump-screen after    │                      │                             │
│ snapshot diff        │                      │ shell integration writes    │
│                      │ signal FIFO ◄─────── │ prompt_ready / last_status  │
└──────────────────────┘                      └─────────────────────────────┘
```

Implementation notes:

- uses **Zellij 0.44+** session and pane targeting
- uses **attach-then-detach** session creation so the pane inherits a wide viewport
- serializes command execution so only one relay command runs at a time
- loads as a normal Pi extension from `src/index.ts` via jiti

## Commands and configuration

### Commands

| Command | Description |
|---------|-------------|
| `/relay-connect` | Connect to an existing Zellij session or create a new one |
| `/relay-status` | Show current relay session, shell, pane, and signal FIFO |

### Tool parameters

#### `shell_relay`

- `command` — required shell command string
- `timeout` — optional timeout in seconds, default `30`
- `session` — optional Zellij session name

#### `shell_relay_inspect`

- `session` — optional Zellij session name

### Environment variables

| Variable | Description |
|----------|-------------|
| `SHELL_RELAY_SESSION` | Default Zellij session name to connect to |

## When to use it

Use **`shell_relay`** when a command needs the user's live shell state.

Use **`bash`** when the command is ordinary, stateless, and does not need the user's interactive environment.

Good candidates for `shell_relay`:

- `op run ...`
- shell functions
- commands that depend on sourced shell setup
- workflows where the user should be able to watch or intervene live

## Troubleshooting

### "Timed out waiting for prompt_ready signal"

The relay session started, but the shell integration did not signal readiness.

Check that:

1. your shell config sources the correct `relay.fish`, `relay.bash`, or `relay.zsh`
2. you restarted the shell after adding the source line
3. the session is running the shell you expected

### "Zellij is not installed or not available"

Install Zellij and ensure `zellij` is on `PATH`.

### Relay works, but output is missing or odd

Remember that output is captured via snapshot diff of terminal content, not raw stdout/stderr pipes.

If the command is highly interactive or paints the screen repeatedly:

- inspect the pane with `shell_relay_inspect`
- or attach directly with `zellij attach <session>`

### I want a specific session

Set:

```bash
export SHELL_RELAY_SESSION=my-session
```

or pass the `session` parameter explicitly on the tool call.

## Related docs

- [AGENTS.md](AGENTS.md) — shell-relay-specific development guidance
- [`.sandpiper/docs/zellij-044-relay-design.md`](../../.sandpiper/docs/zellij-044-relay-design.md) — design notes and Zellij API findings
- [`.sandpiper/docs/background-process-framework-design.md`](../../.sandpiper/docs/background-process-framework-design.md) — background process framework used elsewhere in Sandpiper
