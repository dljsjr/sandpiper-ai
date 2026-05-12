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
  let output = `URL: ${result.url}\n\n${body}`;

  if (result.links && result.links.length > 0) {
    const linkList = result.links.map((link) => `- [${link.text}](${link.href})`).join('\n');
    output += `\n\n---\n\n## Links found on page\n\n${linkList}`;
  }

  return output;
}

export async function executeWebFetchTool(
  adapter: FetchAdapter,
  input: WebFetchToolInput,
  dependencies: WebFetchToolDependencies = {},
): Promise<WebFetchToolResult> {
  const fetchAndExtract = dependencies.fetchAndExtract ?? defaultFetchAndExtract;

  try {
    const result = await fetchAndExtract(adapter, input.url, { filter: input.filter, followLinks: input.followLinks });

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
