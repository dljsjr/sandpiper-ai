# Shell Relay — Bash Shell Integration
#
# Source this file in your ~/.bashrc:
#   source /path/to/relay.bash
#
# This script is safe to source unconditionally in ALL bash instances.
# It is a no-op when the relay is not active ($SHELL_RELAY_SIGNAL is not set).
#
# Components:
#   1. Prompt hook: writes prompt_ready to the signal FIFO via PROMPT_COMMAND
#   2. __relay_run: wrapper function that captures stdout/stderr/exit code via FIFOs
#
# User command capture (DEBUG trap) is deferred to future work.
#
# References: FR-14, FR-3, FR-9

# --- Prompt Hook ---
# Appends to PROMPT_COMMAND to signal pane readiness.

__relay_prompt_hook() {
    # Guard: check that SHELL_RELAY_SIGNAL is defined and writable
    if [[ -z "${SHELL_RELAY_SIGNAL:-}" ]] || [[ ! -w "${SHELL_RELAY_SIGNAL}" ]]; then
        return
    fi

    # Write prompt_ready signal — suppress any errors
    echo "prompt_ready" > "${SHELL_RELAY_SIGNAL}" 2>/dev/null
}

# Append to PROMPT_COMMAND without overwriting existing hooks
if [[ -n "${PROMPT_COMMAND:-}" ]]; then
    PROMPT_COMMAND="${PROMPT_COMMAND};__relay_prompt_hook"
else
    PROMPT_COMMAND="__relay_prompt_hook"
fi

# --- Command Wrapper Function ---
# Wraps a command in the capture pattern.
# Receives the command as a single argument (already shell-quoted by the extension).

__relay_run() {
    # Guard: all three FIFO env vars must be defined
    if [[ -z "${SHELL_RELAY_STDOUT:-}" ]] || [[ -z "${SHELL_RELAY_STDERR:-}" ]] || [[ -z "${SHELL_RELAY_SIGNAL:-}" ]]; then
        echo "shell-relay: FIFO environment variables not set" >&2
        return 1
    fi

    local cmd="$1"
    local __relay_exit

    # Detect unbuffer-relay availability:
    # - SHELL_RELAY_UNBUFFER must point to the script (exported by the extension)
    # - tclsh must be on PATH (provides the TCL runtime + expect package)
    # - SHELL_RELAY_NO_UNBUFFER must not be set (opt-out for testing)
    local use_unbuffer=0
    if [[ -n "${SHELL_RELAY_UNBUFFER:-}" ]] && [[ -z "${SHELL_RELAY_NO_UNBUFFER:-}" ]] && command -v tclsh >/dev/null 2>&1; then
        use_unbuffer=1
    fi

    # Execute with capture pattern
    # Enhanced mode: prefix with unbuffer-relay so the first command gets a PTY.
    # eval runs in the current shell, preserving session state.
    # Basic mode: eval directly (no PTY).
    if [[ $use_unbuffer -eq 1 ]]; then
        {
            eval "${SHELL_RELAY_UNBUFFER}" "$cmd" | tee "${SHELL_RELAY_STDOUT}" > /dev/tty
            __relay_exit=${PIPESTATUS[0]}
        } 2>&1 >/dev/null | tee "${SHELL_RELAY_STDERR}" > /dev/tty
    else
        {
            eval "$cmd" | tee "${SHELL_RELAY_STDOUT}" > /dev/tty
            __relay_exit=${PIPESTATUS[0]}
        } 2>&1 >/dev/null | tee "${SHELL_RELAY_STDERR}" > /dev/tty
    fi

    # Write exit code to signal channel — suppress errors
    echo "last_status:${__relay_exit}" > "${SHELL_RELAY_SIGNAL}" 2>/dev/null
}
