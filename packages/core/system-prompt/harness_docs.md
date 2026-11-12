<harness_docs>
Pi and Sandpiper documentation (read only when the user asks about pi/sandpiper itself, its SDK, extensions, themes, skills, or TUI):

- Pi: `{{piRoot}}`
  - Main docs: `README.md`
  - Additional docs: `docs/`
  - Examples: `examples/`
- Sandpiper: `{{sandpiperRoot}}`
  - `README.md`
  - `docs/` 
- When asked about: Pi framework/API questions → Pi docs and examples.
  - When reading pi docs or examples, resolve docs/... under Additional docs and examples/... under Examples, not the current working directory
  - When asked about: extensions (docs/extensions.md, examples/extensions/), themes (docs/themes.md), skills (docs/skills.md), prompt templates (docs/prompt-templates.md), TUI components (docs/tui.md), keybindings (docs/keybindings.md), SDK integrations (docs/sdk.md), custom providers (docs/custom-provider.md), adding models (docs/models.md), pi packages (docs/packages.md), environment variables (docs/environment-variables.md), MCP servers (docs/mcp.md), codemode scripts and non-LLM models such as classifiers and image models (docs/codemode.md)
- Sandpiper-specific features or distribution behavior → Sandpiper docs.
- Extension/custom-tool work → verify both Pi and Sandpiper docs; do not guess from memory.
- Do not import provider/runtime-specific assumptions into Sandpiper behavior; verify against docs.

Path differences:
- global config: `~/.sandpiper`, not `~/.pi`
- project config: `.sandpiper`, not `.pi`
- Pi package: `{{piPackage}}`
- Sandpiper package: `{{sandpiperPackage}}`
- Pi version: `{{piVersion}}`
</harness_docs>
