/**
 * LLM-facing copy for the web_search tool: name, label, description, prompt snippet,
 * and parameter descriptions. Factored out so the prompt surface has a single owner
 * (Librarian/Piper) separate from the wiring.
 */

export const TOOL_NAME = 'web_search';
export const TOOL_LABEL = 'Web Search';

export const TOOL_DESCRIPTION =
  'Search the web and return a list of results with titles, URLs, and snippets. ' +
  'Use this to discover relevant information when you do not already have a specific URL — ' +
  'for finding documentation, answering questions, researching topics, or locating ' +
  'package pages, blog posts, and API references.';

export const TOOL_PROMPT_SNIPPET = 'Search the web and return relevant results with URLs';

export const TOOL_PROMPT_GUIDELINES = [
  'Combine with web_fetch: use web_search to find URLs, then web_fetch to read the full page content. Do not use this when the user already provides a specific URL — go straight to web_fetch instead.',
];

export const PARAM_QUERY_DESC =
  'The search query. Be specific — include version numbers, library names, or error messages ' +
  'when relevant. Avoid overly broad queries.';
export const PARAM_COUNT_DESC = 'Max number of results to return (default 5, max 20)';
