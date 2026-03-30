# Shell Relay — Fish Shell Integration
#
# Source this file in your ~/.config/fish/config.fish:
#   source ~/.sandpiper/shell-integrations/relay.fish
#
# This script is safe to source unconditionally in all fish instances.
# It is a no-op when the relay is not active.
#
# Components:
#   1. Prompt hook: writes prompt_ready to the signal FIFO on each prompt draw
#   2. __relay_run: evaluates an agent-injected command and reports last_status

function __relay_prompt_hook --on-event fish_prompt
    if not set -q SHELL_RELAY_SIGNAL
        return
    end
    if not test -w "$SHELL_RELAY_SIGNAL"
        return
    end

    echo "prompt_ready" > "$SHELL_RELAY_SIGNAL" 2>/dev/null
end

function __relay_run
    if not set -q SHELL_RELAY_SIGNAL
        echo "shell-relay: signal environment variable not set" >&2
        return 1
    end
    if not test -w "$SHELL_RELAY_SIGNAL"
        echo "shell-relay: signal environment variable not set" >&2
        return 1
    end

    set -l cmd $argv[1]
    eval $cmd
    set -l relay_status $status

    echo "last_status:$relay_status" > "$SHELL_RELAY_SIGNAL" 2>/dev/null
    return $relay_status
end
