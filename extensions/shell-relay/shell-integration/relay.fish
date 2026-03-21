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

    # Unescape the command
    set -l cmd (string unescape --style=script -- $argv[1])

    # Detect unbuffer-relay availability
    set -l use_unbuffer 0
    if not set -q SHELL_RELAY_NO_UNBUFFER
        if command -v unbuffer-relay >/dev/null 2>&1
            set use_unbuffer 1
        end
    end

    # Execute with capture pattern
    if test $use_unbuffer -eq 1
        begin
            unbuffer-relay -p eval $cmd | tee $SHELL_RELAY_STDOUT > /dev/tty
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

# Bind Enter key — only when relay vars are available (optimization, not a guard)
if set -q SHELL_RELAY_SIGNAL
    bind \r __relay_execute
    bind \n __relay_execute
end

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
