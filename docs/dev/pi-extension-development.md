# How to work on Pi extensions in Sandpiper

Sandpiper builds on Pi's extension system. When you change extension behavior in this repository, first decide which surface owns the behavior.

## Choose the extension surface

| Surface                         | Use for                                                                                                                                                    |
| ------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `extensions/system/`            | Sandpiper identity, startup behavior, system prompt assembly, diagnostics, migration controls, session continuity, and Sandpiper-owned system capabilities |
| `plugins/pi/extensions/`        | Neutral Pi package adapters that expose shared capabilities without Sandpiper identity or startup behavior                                                 |
| `extensions/shell-relay/`       | Shell Relay's Zellij-backed shared terminal tools, commands, runtime, and shell integrations                                                               |
| `extensions/autotoon/`          | Legacy compatibility bridge to the package-first AutoTOON adapter                                                                                          |
| `packages/capability-autotoon/` | Host-neutral AutoTOON transform and Pi adapter source of truth                                                                                             |

Keep entrypoints thin. Put reusable logic in package-owned modules or extension-local framework-independent modules, then wire that logic to Pi APIs at the edge.

## Check the Pi docs

Pi's API is the source of truth for extension lifecycle, tools, TUI components, providers, skills, themes, packages, SDK usage, and prompt templates.

When working in this repository, use the installed Pi package docs:

```bash
ls "$PI_CODING_AGENT_PACKAGE/docs"
```

Useful starting points:

- `$PI_CODING_AGENT_PACKAGE/docs/extensions.md`
- `$PI_CODING_AGENT_PACKAGE/docs/tui.md`
- `$PI_CODING_AGENT_PACKAGE/docs/sdk.md`
- `$PI_CODING_AGENT_PACKAGE/docs/packages.md`
- `$PI_CODING_AGENT_PACKAGE/examples/`

Provider, model, and sampling behavior lives in a different package. For anything about
providers, model capabilities, tool sampling (strict JSON schema, grammar tools), or
streaming, read pi-ai's README first:

```bash
less node_modules/@earendil-works/pi-ai/README.md
```

Read these docs before deriving behavior from compiled `dist/` sources. Reading the shipped
JavaScript tells you what the code does; it does not tell you what the API promises, and the
two have differed in ways that changed our conclusions.

When adopting a capability announced in Pi's `CHANGELOG.md`, follow the doc links in that
entry before writing the adoption plan. Entries link directly to the header describing the
feature's contract — `../ai/README.md#...` for provider and sampling behavior, `docs/...`
for coding-agent surfaces. We once adopted a tool-sampling flag from its changelog summary
alone, misread what it guaranteed, shipped it, and reverted it; the entry we planned from
linked to the answer twice.

For upstream source browsing, see the [Pi coding-agent package](https://github.com/badlogic/pi-mono/tree/main/packages/coding-agent).

## Keep source and generated artifacts separate

Extension sources live in `extensions/`, `plugins/pi/extensions/`, and package-owned source directories. Generated artifacts under `dist/` are assembled by the build tooling and should not be edited by hand.

After extension source changes, run:

```bash
bun run prepare:distribution
```

If you changed package-owned built output, `prepare:distribution` builds the package graph first and then reassembles the distribution.

See [Build system](build-system.md) for the full build and distribution workflow.

## Verify behavior

Use focused tests while working:

```bash
bun run test:vitest -- <testpath>
```

Before claiming distribution health, run:

```bash
rm -rf dist && env -u PI_PACKAGE_DIR bun run test:distribution
```
