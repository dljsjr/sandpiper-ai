---
name: Pi Extension Development
read_when: Pi extension, extension lifecycle, pi.events, tool registration, custom tools, TUI, registerMessageRenderer, providers, ExtensionAPI, getFlag, SDK, plugins/pi/extensions, extensions/system, extensions/shell-relay
---

# Pi Extension Development

Read this before changing Pi extensions, custom tools, TUI behavior, provider adapters, or SDK integration.

## Key Rules

- Verify against installed Pi docs and source, not stale memory.
- Keep framework-independent logic in package-owned or extension-local modules; keep Pi entrypoints as thin glue.
- Do not use dynamic imports except for optional dependencies.
- Use host-neutral package seams where available before adding Sandpiper-specific logic.
- For TUI work, load the `tui` skill before changing extension UI.

## Current Extension Surfaces

- `extensions/system/` — Sandpiper identity, system prompt, migration controls, diagnostics, session continuity, system capabilities
- `plugins/pi/extensions/` — neutral Pi adapter surface without Sandpiper identity/startup behavior
- `extensions/shell-relay/` — shared terminal extension
- `extensions/autotoon/` — compatibility bridge to `packages/capability-autotoon/`

## References

- Installed Pi docs: `$PI_CODING_AGENT_PACKAGE/docs/`
- Pi examples: `$PI_CODING_AGENT_PACKAGE/examples/`
- Sandpiper extension overview: `extensions/README.md`
- Sandpiper extension guide: `docs/dev/pi-extension-development.md`
- TUI skill: `.sandpiper/skills/tui/SKILL.md`
