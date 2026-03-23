# Shell Relay — Fish Shell Integration
#
# Source this file in your ~/.config/fish/config.fish:
#   source /path/to/relay.fish
#
# This script is safe to source unconditionally in ALL fish instances.
# It is a no-op when the relay is not active ($SHELL_RELAY_SIGNAL is not set).
#
# Components:
#   1. Prompt hook: writes prompt_ready to the signal FIFO on each prompt draw
#   2. __relay_run: wrapper function that captures stdout/stderr/exit code via FIFOs
#   3. Enter key binding: wraps user-typed commands in the capture pattern
#   4. fish_title: displays clean command in terminal title
#
# References: FR-14, FR-3, FR-9

# --- Prompt Hook ---
# Signals pane readiness to the relay extension.
# Fires on every prompt draw via fish_prompt event.
# Guards on every invocation — silent no-op if signal channel is absent/broken.

function __relay_prompt_hook --on-event fish_prompt
    # Guard: check that SHELL_RELAY_SIGNAL is defined and points to a writable file
    if not set -q SHELL_RELAY_SIGNAL
        return
    end
    if not test -w "$SHELL_RELAY_SIGNAL"
        return
    end

    # Write prompt_ready signal — suppress any errors (broken pipe, etc.)
    echo "prompt_ready" > "$SHELL_RELAY_SIGNAL" 2>/dev/null
end

# --- Command Wrapper Function ---
# Wraps a command in the capture pattern:
#   { [unbuffer-relay -p] eval CMD | tee $STDOUT > /dev/tty; capture exit; } 2>&1 >/dev/null | tee $STDERR > /dev/tty
#
# Receives the command as a single escaped argument (via string escape --style=script).
# Unescapes and evals it in the current shell session.

function __relay_run
    # Guard: all three FIFO env vars must be defined
    if not set -q SHELL_RELAY_STDOUT; or not set -q SHELL_RELAY_STDERR; or not set -q SHELL_RELAY_SIGNAL
        echo "shell-relay: FIFO environment variables not set" >&2
        return 1
    end

    # $argv[1] is the command string — already unescaped by fish's argument parser.
    # The extension escapes the command via `string escape --style=script` before injection,
    # and fish's parser undoes that escaping when it tokenizes the command line.
    set -l cmd $argv[1]

    # Detect unbuffer-relay availability:
    # - SHELL_RELAY_UNBUFFER must point to the script (exported by the extension)
    # - tclsh must be on PATH (provides the TCL runtime + expect package)
    # - SHELL_RELAY_NO_UNBUFFER must not be set (opt-out for testing)
    set -l use_unbuffer 0
    if set -q SHELL_RELAY_UNBUFFER; and not set -q SHELL_RELAY_NO_UNBUFFER
        if command -v tclsh >/dev/null 2>&1
            set use_unbuffer 1
        end
    end

    # Execute with capture pattern
    # Enhanced mode: prefix the command with unbuffer-relay so the first
    # command (or only command) runs in a PTY for isatty(stdout) color
    # preservation. eval runs in the current shell, so session state
    # (functions, non-exported vars) is available for variable expansion
    # and shell builtins. For pipelines, only the first command gets the
    # PTY — subsequent pipeline stages run normally in-session.
    # Basic mode: eval directly in the current shell (no PTY).
    if test $use_unbuffer -eq 1
        begin
            eval $SHELL_RELAY_UNBUFFER $cmd | tee $SHELL_RELAY_STDOUT > /dev/tty
            set -g __relay_exit $pipestatus[1]
        end 2>&1 >/dev/null | tee $SHELL_RELAY_STDERR > /dev/tty
    else
        begin
            eval $cmd | tee $SHELL_RELAY_STDOUT > /dev/tty
            set -g __relay_exit $pipestatus[1]
        end 2>&1 >/dev/null | tee $SHELL_RELAY_STDERR > /dev/tty
    end

    # Write exit code to signal channel — suppress errors
    echo "last_status:$__relay_exit" > "$SHELL_RELAY_SIGNAL" 2>/dev/null
end

# --- Enter Key Binding ---
# Wraps user-typed commands in the capture pattern when the relay is active.
# Preserves default multiline behavior (inserts newline for incomplete commands).

function __relay_execute
    # If relay is not active, use default behavior
    if not set -q SHELL_RELAY_SIGNAL; or not test -w "$SHELL_RELAY_SIGNAL"
        commandline -f execute
        return
    end

    # Get the current command line
    set -l cmd (commandline)

    # If empty, just execute (draws a new prompt)
    if test -z "$cmd"
        commandline -f execute
        return
    end

    # If the command is already a __relay_run invocation (agent-injected),
    # execute it directly — don't double-wrap.
    if string match -qr '^\s*__relay_run ' -- $cmd
        commandline -f execute
        return
    end

    # Check if the command is complete (handles multiline input)
    if not commandline --is-valid
        # Incomplete command — insert newline (default multiline behavior)
        commandline -i \n
        return
    end

    # Escape the command and wrap in __relay_run
    set -l escaped (string escape --style=script -- $cmd)
    commandline -r " __relay_run $escaped"
    commandline -f execute
end

# Bind Enter key unconditionally — __relay_execute has its own guards and
# falls back to default `commandline -f execute` when the relay is inactive.
# This must not be gated on SHELL_RELAY_SIGNAL because the env var is
# exported into the pane after the shell (and this script) has already started.
bind \r __relay_execute
bind \n __relay_execute

# --- Terminal Title Override ---
# Displays the actual command being run, excluding wrapper boilerplate.

function fish_title
    # If running a relay command, extract the real command from __relay_run
    set -l current (status current-command)
    if string match -q "__relay_run *" -- $current
        # Extract the escaped argument and unescape it
        set -l escaped (string replace "__relay_run " "" -- $current)
        string unescape --style=script -- $escaped
    else
        # Default: show the command as-is
        echo $current
    end
end
