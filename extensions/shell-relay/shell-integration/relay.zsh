# Shell Relay — Zsh Shell Integration
#
# Source this file in your ~/.zshrc:
#   source /path/to/relay.zsh
#
# This script is safe to source unconditionally in ALL zsh instances.
# It is a no-op when the relay is not active ($SHELL_RELAY_SIGNAL is not set).
#
# Components:
#   1. Prompt hook: writes prompt_ready to the signal FIFO via precmd
#   2. __relay_run: wrapper function that captures stdout/stderr/exit code via FIFOs
#
# User command capture (zle widget override) is deferred to future work.
#
# References: FR-14, FR-3, FR-9

# --- Prompt Hook ---
# Uses precmd hook to signal pane readiness.

__relay_prompt_hook() {
    # Guard: check that SHELL_RELAY_SIGNAL is defined and writable
    if [[ -z "${SHELL_RELAY_SIGNAL:-}" ]] || [[ ! -w "${SHELL_RELAY_SIGNAL}" ]]; then
        return
    fi

    # Write prompt_ready signal — suppress any errors
    echo "prompt_ready" > "${SHELL_RELAY_SIGNAL}" 2>/dev/null
}

# Register as precmd hook without overwriting existing hooks
autoload -Uz add-zsh-hook
add-zsh-hook precmd __relay_prompt_hook

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

    # Detect unbuffer-relay availability
    local use_unbuffer=0
    if [[ -z "${SHELL_RELAY_NO_UNBUFFER:-}" ]] && command -v unbuffer-relay >/dev/null 2>&1; then
        use_unbuffer=1
    fi

    # Execute with capture pattern
    if [[ $use_unbuffer -eq 1 ]]; then
        {
            unbuffer-relay -p eval "$cmd" | tee "${SHELL_RELAY_STDOUT}" > /dev/tty
            __relay_exit=${pipestatus[1]}
        } 2>&1 >/dev/null | tee "${SHELL_RELAY_STDERR}" > /dev/tty
    else
        {
            eval "$cmd" | tee "${SHELL_RELAY_STDOUT}" > /dev/tty
            __relay_exit=${pipestatus[1]}
        } 2>&1 >/dev/null | tee "${SHELL_RELAY_STDERR}" > /dev/tty
    fi

    # Write exit code to signal channel — suppress errors
    echo "last_status:${__relay_exit}" > "${SHELL_RELAY_SIGNAL}" 2>/dev/null
}
