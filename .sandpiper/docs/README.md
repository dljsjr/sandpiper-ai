# Active internal docs

This directory contains active Sandpiper design and planning documents that are not agent-operational playbooks and are not yet stable public documentation.

Docs here still follow Diátaxis: each page should be a tutorial, how-to guide, reference, or explanation. The `specs/` directory is a status/workflow grouping for active internal specifications; it is not a Diátaxis mode. Normative specs are usually reference, design rationale is explanation, and implementation or migration plans are how-to guides. Completed, superseded, or stale material belongs in `.sandpiper/archive/`.

## Current specs and design notes

| Doc                                                                                                           | Mode                                              | Use when                                                                                                                |
| ------------------------------------------------------------------------------------------------------------- | ------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------- |
| [Background Process Framework](specs/background-process-framework-design.md)                                  | Reference spec with explanatory notes             | Working on process management, background process tools, notifications, or buffer limits                                |
| [Concurrent Sessions](specs/concurrent-sessions.md)                                                           | Explanation                                       | Working on standup concurrency, PID files, liveness, or multi-session handoff                                           |
| [Mutation Testing Setup Plan](specs/mutation-testing.md)                                                      | How-to plan                                       | Implementing mutation testing for Sandpiper packages                                                                    |
| [Agent Conversation Coordination Architecture Review Notes](specs/mailbox-coordination-architecture-notes.md) | Explanation / working design notes                | Reviewing brokerless agent conversation design, prior art, local IPC delivery, or multi-agent coordination architecture |
| [Sandpiper system prompt architecture](specs/sandpiper-system-prompt.md)                                      | Reference spec                                    | Changing Sandpiper prompt assembly, identity replacement, startup context, or dynamic prompt sections                   |
| [Web Fetch Tool PRD](specs/web-fetch-prd.md)                                                                  | Reference spec                                    | Working on web fetch, selectors, JS rendering, web search, crawling, or browser automation                              |
| [Zellij 0.44 Shell Relay Design Notes](specs/zellij-044-relay-design.md)                                      | Reference notes with explanatory design rationale | Working on Shell Relay's Zellij control path, snapshot-diff output capture, or signal protocol                          |
