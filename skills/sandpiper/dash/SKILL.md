---
name: dash
description: >-
  Look up programming documentation using the Dash documentation browser. Use when the
  user asks to check docs, look up an API, find function signatures, search for how to
  use a library or framework, or needs reference documentation for any language or tool.
  Also use when you need to verify your own knowledge against authoritative docs — if
  you're unsure about an API's exact parameters, return types, or behavior, look it up
  rather than guessing. Use when the user mentions "docs", "documentation", "API
  reference", "look up", "how does X work", "what are the parameters for", "Dash", or
  asks about specific functions, classes, or modules in any language or framework they
  have installed in Dash.
compatibility: macOS only. Requires Dash.app installed (https://kapeli.com/dash).
---

# Dash Documentation Lookup

Search and read programming documentation from Dash, a local documentation browser. Dash provides offline, fast access to docsets for hundreds of languages, frameworks, and tools.

This is valuable in two situations: when the **user** asks you to look something up, and when **you** need to verify your own knowledge. If you're about to use an API and aren't fully confident about the exact parameters, return types, or edge-case behavior, look it up. Authoritative docs beat guessing.

## CLI

The `dash` CLI is bundled at `scripts/dash` relative to this skill's directory. **Resolve this path against the skill directory to get the absolute path before running commands.**

## Workflow

The typical flow has three steps: discover what docsets are available, search for what you need, and load the full documentation page.

### 1. List available docsets

First, find out what documentation the user has installed:

```bash
scripts/dash list-installed-docsets
```

This returns a JSON array of docsets with their `name`, `identifier`, and `platform`. The `identifier` is what you pass to search commands — it's an opaque string, not the human-readable name.

### 2. Search for documentation

Search within specific docsets using their identifiers:

```bash
scripts/dash search-documentation --query "createReadStream" --docset-identifiers "qmbvbujj"
```

- `--query` — what you're looking for (function name, class, concept, etc.)
- `--docset-identifiers` — comma-separated list of docset identifiers from step 1
- `--max-results <n>` — limit results (default 100, max 1000)
- `--search-snippets false` — disable snippet search if results are noisy

Results include a `load_url` for each match — this is the key to loading the full page.

### 3. Load a documentation page

Use the `load_url` from a search result to fetch the full documentation:

```bash
scripts/dash load-documentation-page --load-url "http://127.0.0.1:57767/Dash/..."
```

This returns the documentation page as plain text with markdown-style links. The URL must be one returned by a search result (it points to the local Dash API).

### Enabling full-text search

By default, docsets only support name-based search (function names, class names, etc.). To search within documentation body text, enable full-text search for a docset:

```bash
scripts/dash enable-docset-fts --identifier "qmbvbujj"
```

This is a one-time operation per docset. Check the `full_text_search` field in `list-installed-docsets` output — if it says `"disabled"`, you can enable it. If it says `"not supported"`, the docset doesn't support FTS.

## Tips

- **Search multiple docsets at once** by comma-separating identifiers: `--docset-identifiers "id1,id2,id3"`
- **Use the `platform` field** from `list-installed-docsets` to identify docsets when you don't know the exact identifier — e.g., look for `"platform": "nodejs"` for Node.js docs
- **Results are automatically truncated** if they would exceed 25,000 tokens, so don't worry about overwhelming output from broad searches
- **All output is JSON by default** — you can change this with the global `-o` flag (`text`, `markdown`, `json`, `raw`)

## Common Mistakes

**Using the docset name instead of the identifier**: The search command needs the opaque identifier (e.g., `qmbvbujj`), not the human-readable name (`NodeJS 25.8.1`). Always get identifiers from `list-installed-docsets` first.

**Searching without knowing what's installed**: If you search a docset identifier that doesn't exist, you'll get an error. List docsets first, then search.

**Trying to load arbitrary URLs**: The `--load-url` parameter only accepts URLs returned by `search-documentation` — they point to the local Dash API at `127.0.0.1`, not the public internet.

## Reference

For the full tool schemas and type signatures, see `references/toolcall-schema.md`.
