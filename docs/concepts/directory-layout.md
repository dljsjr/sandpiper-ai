# Sandpiper Directory Layout

Sandpiper stores global state under `~/.sandpiper` and project-local state under `.sandpiper/` in each repository. The split lets Sandpiper keep user-wide configuration separate from project-specific context.

## Global `~/.sandpiper`

| Path                             | Purpose                                                                   |
| -------------------------------- | ------------------------------------------------------------------------- |
| `~/.sandpiper/agent/`            | Global agent configuration, guidance, skills, sessions, and project index |
| `~/.sandpiper/agent/AGENTS.md`   | Global agent instructions loaded at startup                               |
| `~/.sandpiper/agent/USER.md`     | User profile and working preferences                                      |
| `~/.sandpiper/agent/inbox/`      | Cross-project handoff notes for agents                                    |
| `~/.sandpiper/agent/projects.md` | Optional user-maintained Markdown routing table for projects              |
| `~/.sandpiper/agent/sessions/`   | JSONL session logs                                                        |
| `~/.sandpiper/pi-acp/`           | ACP adapter state                                                         |

### User profile (`USER.md`)

`USER.md` is an optional Markdown file for durable, user-wide collaboration preferences. Sandpiper loads it into the system prompt at startup so agents can adapt to how you prefer to work across projects.

Put stable information here, such as:

- how you prefer agents to communicate and ask questions
- coding, review, or workflow preferences that apply across repositories
- personal context that helps agents collaborate with you effectively

Do not use `USER.md` for project-specific rules; put those in the project's `AGENTS.md` or `.sandpiper/playbooks/`. Do not use it for temporary session handoff; use Journal when installed.

By default the file lives at `~/.sandpiper/agent/USER.md`. If you configure a custom Sandpiper agent directory, place `USER.md` in that directory instead.

## Project `.sandpiper`

Project-local data lives in `<project>/.sandpiper/`.

| Path                    | Purpose                                                                                                          |
| ----------------------- | ---------------------------------------------------------------------------------------------------------------- |
| `.sandpiper/journal.md` | Short continuation entries managed by the optional standalone Journal skill                                      |
| `.sandpiper/playbooks/` | Project-specific operational guidance for agents                                                                 |
| `.sandpiper/docs/`      | Active internal docs that follow Diátaxis, such as in-flight specs, PRDs, design notes, and implementation plans |
| `.sandpiper/archive/`   | Historical or superseded project docs                                                                            |
| `.sandpiper/notes/`     | Scratch notes and working drafts                                                                                 |
| `.sandpiper/reviews/`   | Temporary code-review artifacts                                                                                  |
| `.sandpiper/skills/`    | Project-specific skills                                                                                          |

Projects do not need every directory. Sandpiper creates or uses the ones needed by installed features and project conventions.
