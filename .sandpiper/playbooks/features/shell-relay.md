---
name: Shell Relay
read_when: shell relay, shell_relay, shell_relay_inspect, Zellij, shared terminal, relay FIFO, shell integration, snapshot-diff, prompt_ready, SHELL_RELAY_SIGNAL, extensions/shell-relay
---

# Shell Relay

Read this before changing the Shell Relay extension, shell integration scripts, relay tools, or Zellij integration.

## Architecture Rules

- Keep core relay behavior framework-independent under `extensions/shell-relay/src/`.
- Keep Pi-specific wiring in `index.ts` and registration/runtime modules under `src/tools/`, `src/commands/`, and `src/runtime.ts`.
- Shell integration scripts live in `extensions/shell-relay/shell-integration/`.
- The extension loads from `src/index.ts` through the package-local `pi.extensions` entry.

## Module Map

| Module                | Purpose                                                                 | Pi imports? |
| --------------------- | ----------------------------------------------------------------------- | ----------- |
| `env-export.ts`       | Shell-appropriate env var export command generation                     | No          |
| `escape.ts`           | Command escaping: fish quote-break, bash/zsh `printf '%q'`              | No          |
| `fifo.ts`             | Persistent FIFO lifecycle using the O_RDWR sentinel pattern             | No          |
| `signal.ts`           | Line-delimited signal channel parser                                    | No          |
| `snapshot-diff.ts`    | Output capture via dump-screen before/after diffing                     | No          |
| `zellij.ts`           | Zellij 0.44+ CLI wrapper                                                | No          |
| `preflight.ts`        | Shell integration preflight check and install-location resolution       | No          |
| `runtime.ts`          | Relay setup/execution lifecycle over structural host/context interfaces | No          |
| `tools/operations.ts` | Host-neutral relay tool execution/result shaping                        | No          |
| `tools/*.ts`          | Tool registration wiring                                                | Yes         |
| `commands/*.ts`       | Slash-command registration wiring                                       | Yes         |
| `index.ts`            | Thin orchestrator for preflight, runtime, registrations, and hooks      | Yes         |

## Current Shell Integration Scope

The shell integration scripts are intentionally narrow:

- `prompt_ready` signals that the pane is back at a prompt.
- `__relay_run` executes an injected command and writes `last_status:N`.
- Output capture is handled by snapshot-diff in TypeScript, not by shell-side stdout/stderr FIFOs.

The scripts only require `SHELL_RELAY_SIGNAL`. They should not assume stdout/stderr FIFOs, PTY wrappers, or legacy relay environment variables.

## Zellij 0.44 API Usage

- Session creation: `zellij attach --create` spawned via background process, then `zellij action detach`.
- Command injection: `paste` plus `send-keys "Enter"`.
- Session targeting: `--session <name>`.
- Pane targeting: `--pane-id terminal_N`.
- Pane discovery: `list-panes --json`.
- Output capture: `dump-screen --full` before/after command, diffed in TypeScript.

## Signal Protocol

Line-delimited text on the signal FIFO:

- `last_status:N\n` — command completed with exit code N
- `prompt_ready\n` — pane is at shell prompt

## Testing Rules

- Snapshot-diff tests should cover custom prompts, multiline prompts, wrapping, blank lines, errors, and special characters.
- Zellij tests should inject mocked process execution; they must not require a running Zellij instance.
- FIFO tests should use real FIFOs (`mkfifo`), not mocks, and clean them up in `afterEach`.
- Escape tests invoke real shells; pass commands via environment variables or stdin.
- Use the `fifo-patterns` skill before modifying FIFO lifecycle logic.

## References

- Public extension README: `extensions/shell-relay/README.md`
- Public feature overview: `docs/features/shell-relay.md`
- Zellij design notes: `.sandpiper/docs/specs/zellij-044-relay-design.md`
- Background process design: `.sandpiper/docs/specs/background-process-framework-design.md`
- Shell Relay task board: `.sandpiper/tasks/SHR/`
