# Shell Relay

Shell Relay lets the agent run commands in a shared Zellij terminal session instead of a fresh subprocess. The user and the agent see the same pane, so commands can use live shell state such as authenticated CLIs, shell functions, activated environments, and non-exported variables.

Use Shell Relay when the built-in `bash` tool would lose important context by starting a separate process tree.

## What it provides

- `shell_relay` runs a command in the shared terminal pane.
- `shell_relay_inspect` reads the current visual state of the pane.
- `/relay-connect` connects an interactive session.
- `/relay-status` shows current relay state.

Shell Relay is lazy-initialized on first use. It chooses a Zellij session from the explicit tool parameter, `SHELL_RELAY_SESSION`, or an auto-generated session name.

## Requirements

- Zellij 0.44 or newer
- Sandpiper shell integration sourced in the user's shell config

The shell integration scripts are safe to source unconditionally. Outside a relay session they silently no-op.

## Related docs

- [Shell Relay extension README](../../extensions/shell-relay/README.md)
- [Session continuity](journal.md)
