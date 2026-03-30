# Shell Relay — Zsh Shell Integration
#
# Source this file in your ~/.zshrc:
#   source ~/.sandpiper/shell-integrations/relay.zsh
#
# This script is safe to source unconditionally in all zsh instances.
# It is a no-op when the relay is not active.
#
# Components:
#   1. Prompt hook: writes prompt_ready to the signal FIFO via precmd
#   2. __relay_run: evaluates an agent-injected command and reports last_status

__relay_prompt_hook() {
    if [[ -z "${SHELL_RELAY_SIGNAL:-}" ]] || [[ ! -w "${SHELL_RELAY_SIGNAL}" ]]; then
        return
    fi

    echo "prompt_ready" > "${SHELL_RELAY_SIGNAL}" 2>/dev/null
}

autoload -Uz add-zsh-hook
add-zsh-hook precmd __relay_prompt_hook

__relay_run() {
    if [[ -z "${SHELL_RELAY_SIGNAL:-}" ]] || [[ ! -w "${SHELL_RELAY_SIGNAL}" ]]; then
        echo "shell-relay: signal environment variable not set" >&2
        return 1
    fi

    local cmd="$1"
    local relay_status

    eval "$cmd"
    relay_status=$?

    echo "last_status:${relay_status}" > "${SHELL_RELAY_SIGNAL}" 2>/dev/null
    return "${relay_status}"
}
