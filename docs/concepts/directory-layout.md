# Sandpiper Directory Layout

Sandpiper stores global state under `~/.sandpiper` and project-local state under `.sandpiper/` in each repository. The split lets Sandpiper keep user-wide configuration separate from project-specific context.

## Global `~/.sandpiper`

| Path                               | Purpose                                                                      |
| ---------------------------------- | ---------------------------------------------------------------------------- |
| `~/.sandpiper/agent/`              | Global agent configuration, guidance, skills, sessions, and project registry |
| `~/.sandpiper/agent/AGENTS.md`     | Global agent instructions loaded at startup                                  |
| `~/.sandpiper/agent/USER.md`       | User profile and working preferences                                         |
| `~/.sandpiper/agent/inbox/`        | Cross-project handoff notes for agents                                       |
| `~/.sandpiper/agent/projects.toon` | Registry of projects touched by Sandpiper                                    |
| `~/.sandpiper/agent/sessions/`     | JSONL session logs                                                           |
| `~/.sandpiper/shell-integrations/` | Shell integration scripts used by Shell Relay                                |
| `~/.sandpiper/pi-acp/`             | ACP adapter state                                                            |

## Project `.sandpiper`

Project-local data lives in `<project>/.sandpiper/`.

| Path                    | Purpose                                                                                                          |
| ----------------------- | ---------------------------------------------------------------------------------------------------------------- |
| `.sandpiper/standup.md` | Session handoff note for continuity across agent sessions                                                        |
| `.sandpiper/tasks/`     | Project task tracker data                                                                                        |
| `.sandpiper/playbooks/` | Project-specific operational guidance for agents                                                                 |
| `.sandpiper/docs/`      | Active internal docs that follow Diátaxis, such as in-flight specs, PRDs, design notes, and implementation plans |
| `.sandpiper/archive/`   | Historical or superseded project docs                                                                            |
| `.sandpiper/notes/`     | Scratch notes and working drafts                                                                                 |
| `.sandpiper/reviews/`   | Temporary code-review artifacts                                                                                  |
| `.sandpiper/skills/`    | Project-specific skills                                                                                          |

Projects do not need every directory. Sandpiper creates or uses the ones needed by installed features and project conventions.
