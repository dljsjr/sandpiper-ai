# Context Files

Context files are Markdown files of standing instructions that Sandpiper puts into every session's system prompt. Sandpiper uses Pi's context files, `AGENTS.md` and `CLAUDE.md`, and adds one of its own, `USER.md`.

## `AGENTS.md` and `CLAUDE.md`

Pi loads `AGENTS.md` or `CLAUDE.md` from the agent directory, from the working directory, and from each parent directory of the working directory. A file applies whenever Sandpiper runs in its directory or anywhere below it. For Sandpiper, the agent directory is `~/.sandpiper/agent/`, so `~/.sandpiper/agent/AGENTS.md` holds your instructions for every project, and a project's `AGENTS.md` holds rules for that project.

Sandpiper renders the files it loads in the `<injected_context>` section of its system prompt. When two files conflict, the more specific one wins: a project's file over the global one, and a subdirectory's file over the project root's.

Pi's configuration docs (`docs/configuration.md` in the Pi package) describe the full lookup, including `AGENTS.override.md`. `-nc` (`--no-context-files`) turns off discovery of these files.

## `USER.md`

`USER.md` is Sandpiper's addition to the context files: a sibling of the global `AGENTS.md` that describes the person using Sandpiper. Stock Pi does not read it. Sandpiper loads it into the system prompt at startup so agents can adapt to how you prefer to work across projects.

Put durable, user-wide information here, such as:

- how you prefer agents to communicate and ask questions
- coding, review, or workflow preferences that apply across repositories
- personal context that helps agents collaborate with you effectively

Do not use `USER.md` for project-specific rules; put those in the project's `AGENTS.md` or `.sandpiper/playbooks/`. Do not use it for temporary session handoff; use Journal when installed.

By default the file lives at `~/.sandpiper/agent/USER.md`. If you configure a custom Sandpiper agent directory, place `USER.md` in that directory instead.

`USER.md` is part of Sandpiper's own system prompt, so a custom system prompt (`--system-prompt` or `SYSTEM.md`) leaves it out. `-nc` does not affect it.
