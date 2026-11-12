import { fetchAndExtract as defaultFetchAndExtract } from './pipeline.js';
import type {
  FetchAdapter,
  LlmsTxtProbeResult,
  WebFetchFilterDetails,
  WebFetchFilterSpec,
  WebFetchResult,
} from './types.js';

export interface WebFetchToolInput {
  readonly url: string;
  readonly followLinks?: boolean;
  readonly filter?: WebFetchFilterSpec;
  readonly render?: boolean;
}

// Mirrors Pi's text content item shape without importing Pi SDK types into the operation layer.
interface TextContent {
  readonly type: 'text';
  readonly text: string;
}

export interface WebFetchToolDetails extends Record<string, unknown> {
  readonly url: string;
  readonly title?: string;
  readonly llmsTxt?: LlmsTxtProbeResult;
  readonly filter?: WebFetchFilterDetails;
  readonly error?: string;
}

export interface WebFetchToolResult {
  readonly content: TextContent[];
  readonly details: WebFetchToolDetails;
}

export interface WebFetchToolDependencies {
  readonly fetchAndExtract?: typeof defaultFetchAndExtract;
  /** Adapter that loads pages in a headless browser. Absent when no renderer is available. */
  readonly renderAdapter?: FetchAdapter;
}

const LLMS_TXT_INSTRUCTIONS =
  'This site publishes an index of its pages for language models at the llms_txt url. ' +
  'To find another page on this site, fetch that index with web_fetch instead of guessing a URL. ' +
  'The index is Markdown: a markdown_section filter with one of its headings returns that part alone.';

function formatLlmsTxtMetadata(llmsTxt: LlmsTxtProbeResult): string {
  const lines = [
    '<additional_content>',
    `  <instructions>${LLMS_TXT_INSTRUCTIONS}</instructions>`,
    '  <llms_txt',
    `    status="${llmsTxt.status}"`,
    `    url="${llmsTxt.url}"`,
    ...(llmsTxt.statusCode === undefined ? [] : [`    http_status="${llmsTxt.statusCode}"`]),
    '  />',
    '</additional_content>',
  ];
  return lines.join('\n');
}

export function formatWebFetchResult(result: WebFetchResult): string {
  const header = [
    result.title && `# ${result.title}`,
    result.byline && `*By ${result.byline}*`,
    result.siteName && `*Source: ${result.siteName}*`,
    result.excerpt && `> ${result.excerpt}`,
  ]
    .filter(Boolean)
    .join('\n\n');

  const body = header ? `${header}\n\n---\n\n${result.content}` : result.content;
  const source = result.markdownSource ? `\nMarkdown source: ${result.markdownSource}` : '';
  let output = `URL: ${result.url}${source}\n\n${body}`;

  if (result.links && result.links.length > 0) {
    const linkList = result.links.map((link) => `- [${link.text}](${link.href})`).join('\n');
    output += `\n\n---\n\n## Links found on page\n\n${linkList}`;
  }

  if (result.llmsTxt?.exists === true && result.llmsTxt.url !== result.url) {
    output += `\n\n---\n\n${formatLlmsTxtMetadata(result.llmsTxt)}`;
  }

  return output;
}

function selectAdapter(
  adapter: FetchAdapter,
  input: WebFetchToolInput,
  dependencies: WebFetchToolDependencies,
): FetchAdapter {
  if (!input.render) return adapter;
  if (!dependencies.renderAdapter) {
    throw new Error('rendering is not available because no renderer is loaded');
  }
  return dependencies.renderAdapter;
}

export async function executeWebFetchTool(
  adapter: FetchAdapter,
  input: WebFetchToolInput,
  dependencies: WebFetchToolDependencies = {},
): Promise<WebFetchToolResult> {
  const fetchAndExtract = dependencies.fetchAndExtract ?? defaultFetchAndExtract;

  try {
    const result = await fetchAndExtract(selectAdapter(adapter, input, dependencies), input.url, {
      filter: input.filter,
      followLinks: input.followLinks,
      ...(input.render ? { render: true } : {}),
    });

    return {
      content: [{ type: 'text', text: formatWebFetchResult(result) }],
      details: {
        url: result.url,
        title: result.title,
        ...(result.llmsTxt === undefined ? {} : { llmsTxt: result.llmsTxt }),
        ...(result.filter === undefined ? {} : { filter: result.filter }),
      },
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return {
      content: [{ type: 'text', text: `Failed to fetch ${input.url}: ${message}` }],
      details: { url: input.url, error: message },
    };
  }
}
