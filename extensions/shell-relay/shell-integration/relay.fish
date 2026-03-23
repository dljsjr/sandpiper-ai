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
#   2. __relay_run: wrapper function for agent-injected commands
#   3. fish_preexec hook: dynamically wraps user commands via function shadowing
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

# --- Capture Helper ---
# Runs a command through the capture pattern (tee + FIFOs + exit code + signal).
# Used by both __relay_run (agent commands) and dynamic wrappers (user commands).
#
# Usage: __relay_capture <command> [args...]
# The first argument is the command name, remaining are its arguments.
# Uses `command` prefix to bypass function lookup (avoids recursion with wrappers).

function __relay_capture
    # Guard: all three FIFO env vars must be defined
    if not set -q SHELL_RELAY_STDOUT; or not set -q SHELL_RELAY_STDERR; or not set -q SHELL_RELAY_SIGNAL
        # Not in a relay session — run the command directly
        command $argv
        return $status
    end

    # Detect unbuffer-relay availability.
    # Only use unbuffer when stdout is a TTY — if this command is in the
    # middle/tail of a pipeline, stdout is a pipe and unbuffer is unnecessary.
    # This avoids redundant PTY wrapping for `jj log | grep foo | head`.
    set -l use_unbuffer 0
    if test -t 1; and set -q SHELL_RELAY_UNBUFFER; and not set -q SHELL_RELAY_NO_UNBUFFER
        if command -v tclsh >/dev/null 2>&1
            set use_unbuffer 1
        end
    end

    # Execute with capture pattern
    # Enhanced mode: unbuffer-relay wraps the command in a PTY for color preservation.
    # Basic mode: run the command directly (no PTY).
    # In both cases, `command` prefix bypasses function lookup to call the real binary.
    if test $use_unbuffer -eq 1
        begin
            $SHELL_RELAY_UNBUFFER command $argv | tee $SHELL_RELAY_STDOUT > /dev/tty
            set -g __relay_exit $pipestatus[1]
        end 2>&1 >/dev/null | tee $SHELL_RELAY_STDERR > /dev/tty
    else
        begin
            command $argv | tee $SHELL_RELAY_STDOUT > /dev/tty
            set -g __relay_exit $pipestatus[1]
        end 2>&1 >/dev/null | tee $SHELL_RELAY_STDERR > /dev/tty
    end

    # Write exit code to signal channel — suppress errors
    echo "last_status:$__relay_exit" > "$SHELL_RELAY_SIGNAL" 2>/dev/null
    return $__relay_exit
end

# --- Capture Helper for Functions ---
# Like __relay_capture but calls a function directly (no `command` prefix).
# Used for wrapping existing fish functions (e.g., fish's `ls` wrapper).

function __relay_capture_fn
    if not set -q SHELL_RELAY_STDOUT; or not set -q SHELL_RELAY_STDERR; or not set -q SHELL_RELAY_SIGNAL
        $argv
        return $status
    end

    set -l use_unbuffer 0
    if set -q SHELL_RELAY_UNBUFFER; and not set -q SHELL_RELAY_NO_UNBUFFER
        if command -v tclsh >/dev/null 2>&1
            set use_unbuffer 1
        end
    end

    # Note: no `command` prefix — call the function directly.
    # unbuffer-relay can't wrap functions (they're not binaries),
    # so in enhanced mode we fall back to basic for function calls.
    begin
        $argv | tee $SHELL_RELAY_STDOUT > /dev/tty
        set -g __relay_exit $pipestatus[1]
    end 2>&1 >/dev/null | tee $SHELL_RELAY_STDERR > /dev/tty

    echo "last_status:$__relay_exit" > "$SHELL_RELAY_SIGNAL" 2>/dev/null
    return $__relay_exit
end

# --- Command Wrapper Function ---
# Used by the agent (via write-chars injection) to execute commands in the pane.
# Receives a single escaped argument, unescapes it, and evals it through the
# capture pattern.

function __relay_run
    # Guard: all three FIFO env vars must be defined
    if not set -q SHELL_RELAY_STDOUT; or not set -q SHELL_RELAY_STDERR; or not set -q SHELL_RELAY_SIGNAL
        echo "shell-relay: FIFO environment variables not set" >&2
        return 1
    end

    set -l cmd $argv[1]

    # Detect unbuffer-relay availability
    set -l use_unbuffer 0
    if set -q SHELL_RELAY_UNBUFFER; and not set -q SHELL_RELAY_NO_UNBUFFER
        if command -v tclsh >/dev/null 2>&1
            set use_unbuffer 1
        end
    end

    # Execute with capture pattern (eval for agent commands — supports
    # pipes, redirections, compound commands, shell builtins)
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

    echo "last_status:$__relay_exit" > "$SHELL_RELAY_SIGNAL" 2>/dev/null
end

# --- Dynamic Command Wrapping via fish_preexec ---
# When the relay is active, intercepts user commands by dynamically creating
# wrapper functions that shadow the command being executed. Fish resolves
# command names after preexec handlers complete, so the wrapper takes effect
# for the current execution.
#
# The wrapper chain preserves tab completion via --wraps:
#   `cmd` (wrapper) --wraps `__relay_wrap_cmd` --wraps `cmd` (original)
#
# Wrappers are only created in-memory (no funcsave), so they exist only in
# the relay session. Each command is only wrapped once — subsequent calls
# reuse the existing wrapper.

function __relay_preexec --on-event fish_preexec
    # Guard: only wrap when relay is active
    if not set -q SHELL_RELAY_SIGNAL; or not test -w "$SHELL_RELAY_SIGNAL"
        return
    end

    # Get the leading command name from the commandline
    set -l tokens (string split ' ' -- $argv[1])
    set -l cmd_name $tokens[1]

    # Skip empty commands
    if test -z "$cmd_name"
        return
    end

    # Skip if this is already an agent-injected __relay_run command
    if test "$cmd_name" = __relay_run
        return
    end

    # Skip if we've already wrapped this command
    if functions -q __relay_wrap_$cmd_name
        return
    end

    # Skip shell builtins — can't wrap them, and they don't produce
    # colored output that needs PTY preservation.
    if builtin -q $cmd_name
        return
    end

    # Determine how to call the original:
    # - If it's an existing function, copy it and call the copy
    # - If it's an external binary, use `command` prefix
    if functions -q $cmd_name
        # Save the original function before we shadow it
        functions -c $cmd_name __relay_original_$cmd_name

        # Wrapper calls the saved original function
        eval "function __relay_wrap_$cmd_name --wraps $cmd_name
            __relay_capture_fn __relay_original_$cmd_name \$argv
        end"
    else if command -v $cmd_name >/dev/null 2>&1
        # Wrapper calls the external binary via `command`
        eval "function __relay_wrap_$cmd_name --wraps $cmd_name
            __relay_capture $cmd_name \$argv
        end"
    else
        # Not a function, not a binary — skip (e.g., alias, abbreviation)
        return
    end

    # Shadow the original command name with a function that delegates
    # to the wrapper. --wraps is transitive, so completions are preserved.
    eval "function $cmd_name --wraps __relay_wrap_$cmd_name
        __relay_wrap_$cmd_name \$argv
    end"
end

# --- Terminal Title Override ---
# Displays the actual command being run, excluding wrapper boilerplate.

function fish_title
    set -l current (status current-command)
    # If running through the capture helper, show the real command
    if string match -q "__relay_capture *" -- $current
        string replace "__relay_capture " "" -- $current
    else if string match -q "__relay_wrap_*" -- $current
        string replace -r "__relay_wrap_" "" -- $current
    else if string match -q "__relay_run *" -- $current
        set -l escaped (string replace "__relay_run " "" -- $current)
        string unescape --style=script -- $escaped
    else
        echo $current
    end
end
