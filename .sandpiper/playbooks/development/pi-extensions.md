---
name: Pi Extension Development
read_when: Pi extension, extension lifecycle, pi.events, tool registration, custom tools, TUI, registerMessageRenderer, providers, ExtensionAPI, getFlag, SDK, extensions/system
---

# Pi Extension Development

Read this before changing Pi extensions, custom tools, TUI behavior, provider adapters, or SDK integration.

## Key Rules

- Verify against installed Pi docs and source, not stale memory.
- Do not carry provider- or runtime-specific assumptions into Sandpiper behavior. Verify them against the docs first.
- Keep framework-independent logic in package-owned or extension-local modules; keep Pi entrypoints as thin glue.
- Do not use dynamic imports except for optional dependencies.
- Use host-neutral package seams where available before adding Sandpiper-specific logic.
- For TUI work, load the `tui` skill before changing extension UI.
- Do not return `systemPrompt` from `before_agent_start`: on Pi 1.0 it forces that text for one run and is not recorded. Add prompt text through `systemPromptOptions.sections` or Sandpiper's prompt contribution channel. See `.sandpiper/docs/specs/sandpiper-system-prompt.md`.

## Current Extension Surfaces

- `extensions/system/` — Sandpiper identity, system prompt, session continuity, system capabilities
- `extensions/autotoon/` — Pi adapter for AutoTOON and its framework-independent transform in `core.ts`
- `extensions/tattler/` — Tattler peer messaging: `list_peers`, `send_peer_message`, and the inbox
- `extensions/chorus.ts` — Chorus rooms. Parked until a rewrite: the CLI does not load it, and its tests keep it working.
- `extensions/web-fetch/` — `web_fetch` tool
- `extensions/web-search/` — `web_search` tool

## References

- Installed Pi docs: `$PI_CODING_AGENT_PACKAGE/docs/`
- Pi examples: `$PI_CODING_AGENT_PACKAGE/examples/`
- Sandpiper extension overview: `extensions/README.md`
- Sandpiper extension guide: `docs/dev/pi-extension-development.md`
- TUI skill: `.sandpiper/skills/tui/SKILL.md`
