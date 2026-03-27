# Zellij 0.44 Shell Relay Design Notes

Research notes from the Zellij 0.44 CLI recipes and programmatic control docs.
Reference for SHR-75 through SHR-79.

## Key Discovery: `paste` + `send-keys` Pattern

The docs recommend `paste` (bracketed paste mode) for text injection, NOT `write-chars`:

```bash
zellij action paste --pane-id $PANE_ID "echo hello" &&
zellij action send-keys --pane-id $PANE_ID "Enter"
```

- `paste` uses bracketed paste mode — faster and more robust than `write-chars`
- `send-keys` handles human-readable key names (`Enter`, `Ctrl c`, `F1`)
- Both accept `--pane-id` for targeted delivery without focus changes

## Key Discovery: Ghost Client Is No Longer Needed

The entire ghost client mechanism (`ghost-attach` expect script) existed because
`write-chars` and `dump-screen` required a focused PTY client. In 0.44:

1. `attach --create-background` creates a headless session
2. All actions accept `--session <name>` for cross-session targeting
3. All actions accept `--pane-id` for pane-level targeting
4. No attached client is required for any of these to work

**The ghost client can be eliminated entirely.**

## Key Discovery: Pane IDs Are First-Class

- `$ZELLIJ_PANE_ID` env var is set in every pane automatically
- `new-pane` returns the pane ID on stdout
- `list-panes --json` gives full pane metadata including exit status
- All actions accept `--pane-id` — no more "target the focused pane" semantics

## Key Discovery: `list-panes --json` Has Rich Metadata

```json
{
  "id": 1,
  "is_plugin": false,
  "is_focused": true,
  "title": "/bin/bash",
  "exited": false,
  "exit_status": null,
  "is_held": false,
  "pane_command": "bash",
  "pane_cwd": "/home/user/project",
  "tab_id": 0,
  "tab_name": "Tab #1"
}
```

This replaces `waitForPane` (dump-screen-to-dev-null polling) with a proper
metadata query. Also useful for reconnection — find the right pane by command,
cwd, or tab name.

## Key Discovery: `subscribe` JSON Format

```bash
zellij subscribe --pane-id terminal_1 --format json
```

Produces NDJSON with `pane_update` events containing `viewport[]` and `scrollback[]`
arrays, plus `pane_closed` events. Fires on every re-render.

From live testing:
- Bulk injections (paste/send-keys) produce ~4 events: chars, enter, output, prompt
- Interactive typing produces one event per keystroke
- Content is the full rendered viewport — includes prompt decorations, ANSI

## Proposed New Architecture

### Session Setup (replaces ghost-attach + FIFO creation)

```bash
# Create background session (no ghost client needed)
zellij attach --create-background $SESSION

# Pane ID is already available — the default pane in the session
# Or create a new pane and capture its ID
PANE_ID=$(zellij --session $SESSION action new-pane)
```

### Command Injection (replaces write-chars)

```bash
# Paste the command text (bracketed paste mode — fast, robust)
zellij --session $SESSION action paste --pane-id $PANE_ID "$COMMAND" &&
# Send Enter to execute
zellij --session $SESSION action send-keys --pane-id $PANE_ID "Enter"
```

### Output Capture

Two options, to be evaluated in SHR-75:

**Option A: Keep FIFOs for structured output**
- Shell integration writes stdout/stderr to FIFOs (current approach)
- `subscribe` or `dump-screen` as supplementary/fallback
- Exit codes via shell integration `prompt_ready` signal

**Option B: Viewport-based capture via dump-screen**
- After command injection, wait for `prompt_ready` signal (still via FIFO or subscribe)
- `dump-screen --pane-id $PANE_ID --full` to capture everything
- Parse output between command and next prompt
- Lose stdout/stderr separation but eliminate FIFO complexity

**Option C: Hybrid — FIFOs for exit code, viewport for output**
- Shell integration only signals prompt_ready + exit code (minimal)
- `dump-screen` captures the visual output post-completion
- Simplest shell integration, richest output (includes colors if --ansi)

### Pane Health Check (replaces waitForPane polling)

```bash
zellij --session $SESSION action list-panes --json \
  | jq '.[] | select(.id == 1) | .exited'
```

### What Stays

- **Shell integration scripts** — still needed for prompt_ready signaling and exit code
  capture. Zellij's viewport stream doesn't provide process-level boundaries.
  BUT the integration could be *much* simpler — just prompt_ready + exit code,
  no stdout/stderr redirection.
- **Signal FIFO** — still the cleanest IPC for prompt_ready events from the shell

### What Goes

- **Ghost client** (`ghost-attach` expect script) — eliminated by --pane-id targeting
- **stdout/stderr FIFOs** — likely replaced by dump-screen capture (TBD in SHR-75)
- **`write-chars`** — replaced by `paste` + `send-keys`
- **`ZELLIJ_SESSION_NAME` env var** — replaced by `--session` flag
- **`dump-screen /dev/null` polling** — replaced by `list-panes --json`

## Additional Opportunities

### Pane Colors for Status Indication

```bash
# Flash pane red on error
zellij action set-pane-color --pane-id $PANE_ID --bg "#5a0000"
sleep 1
zellij action set-pane-color --pane-id $PANE_ID --reset
```

### Borderless Pinned Overlays

Could create a persistent status overlay (borderless, pinned, floating) that
shows relay status without taking up pane space.

### Concurrency Safety

From the docs: "Actions targeting different panes or tabs can be issued
concurrently without conflict." But: "Avoid concurrent mutations to the same
pane." Our relay already serializes commands per-pane, so this is fine.

## Source Documentation

- CLI Recipes: https://zellij.dev/documentation/cli-recipes.html
- Programmatic Control: https://zellij.dev/documentation/programmatic-control.html
- Subscribe: https://zellij.dev/documentation/zellij-subscribe.html
- CLI Actions: https://zellij.dev/documentation/cli-actions.html
