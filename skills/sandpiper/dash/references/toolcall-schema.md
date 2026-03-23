dash

  /**
   * List all installed documentation sets in Dash. An empty list is returned if the user has no docsets
   * installed.
   * Results are automatically truncated if they would exceed 25,000 tokens.
   */
  function list_installed_docsets(): DocsetResults;
      {
        "type": "object",
        "properties": {},
        "title": "list_installed_docsetsArguments"
      }

  /**
   * Search for documentation across docset identifiers and snippets.
   * Args:
   * query: The search query string
   * docset_identifiers: Comma-separated list of docset identifiers to search in (from
   * list_installed_docsets)
   * search_snippets: Whether to include snippets in search results
   * max_results: Maximum number of results to return (1-1000)
   * Results are automatically truncated if they would exceed 25,000 tokens.
   */
  function search_documentation(query: string, docset_identifiers: string, search_snippets?: boolean, max_results?: number): SearchResults;
      {
        "type": "object",
        "properties": {
          "query": {
            "title": "Query",
            "type": "string"
          },
          "docset_identifiers": {
            "title": "Docset Identifiers",
            "type": "string"
          },
          "search_snippets": {
            "default": true,
            "title": "Search Snippets",
            "type": "boolean"
          },
          "max_results": {
            "default": 100,
            "title": "Max Results",
            "type": "integer"
          }
        },
        "required": [
          "query",
          "docset_identifiers"
        ],
        "title": "search_documentationArguments"
      }

  /**
   * Enable full-text search for a specific docset.
   * Args:
   * identifier: The docset identifier (from list_installed_docsets)
   * Returns:
   * True if FTS was successfully enabled, False otherwise
   */
  function enable_docset_fts(identifier: string): enable_docset_ftsOutput;
      {
        "type": "object",
        "properties": {
          "identifier": {
            "title": "Identifier",
            "type": "string"
          }
        },
        "required": [
          "identifier"
        ],
        "title": "enable_docset_ftsArguments"
      }

  /**
   * Load a documentation page from a load_url returned by search_documentation.
   * Args:
   * load_url: The load_url value from a search result (must point to the local Dash API at 127.0.0.1)
   * Returns:
   * The documentation page content as plain text with markdown-style links
   */
  function load_documentation_page(load_url: string): DocumentationPage;
      {
        "type": "object",
        "properties": {
          "load_url": {
            "title": "Load Url",
            "type": "string"
          }
        },
        "required": [
          "load_url"
        ],
        "title": "load_documentation_pageArguments"
      }

  Examples:
    mcporter call dash.list_installed_docsets()

  4 tools · 1075ms · STDIO mise x uv@latest -- uvx --from git+https://github.com/Kapeli/dash-mcp-server.git dash-mcp-server

