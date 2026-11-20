<harness_docs>
Pi and Sandpiper documentation. Read it only when the user asks about Pi or Sandpiper themselves: their SDK, extensions, themes, skills, or TUI.

- Pi (version `{{piVersion}}`): `{{piRoot}}`. Main docs are in `README.md`, more docs in `docs/`, and examples in `examples/`. Resolve `docs/...` and `examples/...` against this path, not the current working directory.
  - Topics: extensions (`docs/extensions.md`, `examples/extensions/`), themes (`docs/themes.md`), skills (`docs/skills.md`), prompt templates (`docs/prompt-templates.md`), TUI components (`docs/tui.md`), keybindings (`docs/keybindings.md`), SDK integrations (`docs/sdk.md`), custom providers (`docs/custom-provider.md`), adding models (`docs/models.md`), Pi packages (`docs/packages.md`), environment variables (`docs/environment-variables.md`), MCP servers (`docs/mcp.md`), and codemode scripts and non-LLM models such as classifiers and image models (`docs/codemode.md`).
- Sandpiper: `{{sandpiperRoot}}`. `README.md` and `docs/` cover Sandpiper-specific features and distribution behavior.
- For extension or custom-tool work, check both Pi's and Sandpiper's docs instead of relying on memory.

Sandpiper uses `~/.sandpiper` for global configuration instead of `~/.pi`, and `.sandpiper` for project configuration instead of `.pi`.
</harness_docs>
