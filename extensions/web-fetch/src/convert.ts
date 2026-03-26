/**
 * HTML → markdown conversion using Turndown.
 * Framework-independent — no pi imports.
 */

import TurndownService from 'turndown';

let service: TurndownService | null = null;

function getService(): TurndownService {
  if (!service) {
    service = new TurndownService({
      headingStyle: 'atx',
      codeBlockStyle: 'fenced',
      bulletListMarker: '-',
      emDelimiter: '*',
    });

    // Preserve code block language hints from <pre><code class="language-xxx">
    service.addRule('fencedCodeBlock', {
      filter: (node, options) => {
        return (
          options.codeBlockStyle === 'fenced' &&
          node.nodeName === 'PRE' &&
          node.firstChild !== null &&
          node.firstChild.nodeName === 'CODE'
        );
      },
      replacement: (_content, node) => {
        const codeElement = node.firstChild as HTMLElement;
        const className = codeElement.getAttribute?.('class') ?? '';
        const langMatch = className.match(/language-(\S+)/);
        const language = langMatch?.[1] ?? '';
        const code = codeElement.textContent ?? '';
        return `\n\n\`\`\`${language}\n${code.replace(/\n$/, '')}\n\`\`\`\n\n`;
      },
    });
  }
  return service;
}

/**
 * Convert cleaned HTML to markdown.
 */
export function htmlToMarkdown(html: string): string {
  return getService().turndown(html);
}
