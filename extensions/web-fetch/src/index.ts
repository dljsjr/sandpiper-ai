/**
 * Pi extension entry point for web-fetch.
 * Thin glue layer — delegates all logic to framework-independent modules.
 */

import type { AgentToolResult, ExtensionAPI } from '@mariozechner/pi-coding-agent';
import { Type } from '@sinclair/typebox';
import { SimpleFetchAdapter } from './fetch.js';
import { fetchAndExtract } from './pipeline.js';

export default async function init(pi: ExtensionAPI) {
  const adapter = new SimpleFetchAdapter();

  pi.registerTool({
    name: 'web_fetch',
    label: 'Web Fetch',
    description:
      'Fetch a web page and return its content as clean markdown. ' +
      'Use this to read documentation, READMEs, API references, blog posts, ' +
      'package details, or any web page the user points you to. ' +
      'Returns structured metadata (title, excerpt, byline) plus the page ' +
      'content converted to token-efficient markdown.',
    parameters: Type.Object({
      url: Type.String({ description: 'The URL to fetch' }),
      followLinks: Type.Optional(
        Type.Boolean({
          description: 'If true, extract and return links found in the page content',
        }),
      ),
    }),
    async execute(_toolCallId, params): Promise<AgentToolResult<unknown>> {
      const { url, followLinks } = params;

      try {
        const result = await fetchAndExtract(adapter, url, { followLinks });

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
          const linkList = result.links.map((l) => `- [${l.text}](${l.href})`).join('\n');
          output += `\n\n---\n\n## Links found on page\n\n${linkList}`;
        }

        return {
          content: [{ type: 'text' as const, text: output }],
          details: { url: result.url, title: result.title },
        };
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        return {
          content: [{ type: 'text' as const, text: `Failed to fetch ${url}: ${message}` }],
          details: { url, error: message },
        };
      }
    },
  });
}
