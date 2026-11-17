import { describe, expect, it } from 'vitest';
// Pi does not export the prompt builder; this is the installed module that Sandpiper's local patch changes.
import {
  type BuildSystemPromptOptions,
  buildSystemPromptSections,
} from '../../node_modules/@earendil-works/pi-coding-agent/dist/core/system-prompt.js';

const DEFERRED_INSTRUCTIONS =
  'These tools are not loaded yet. Load one with `tool_search`, searching for its name. It can be called from your next call.';

const snippets = {
  read: 'Read file contents',
  tool_search: 'Search for tools that are not loaded yet and load the matches',
  web_fetch: 'Fetch a web page and return clean markdown content',
  web_search: 'Search the web',
};

function toolsSection(options: Partial<BuildSystemPromptOptions>): string | undefined {
  return buildSystemPromptSections({
    cwd: '/repo',
    customPrompt: 'Sandpiper preamble',
    toolSnippets: snippets,
    ...options,
  }).tools;
}

describe('deferred tools in the patched tools section', () => {
  it('lists deferred tools that are not loaded between the tool list and the closing line', () => {
    const tools = toolsSection({
      selectedTools: ['read', 'tool_search'],
      deferredTools: ['web_fetch', 'web_search'],
    });

    expect(tools).toBe(
      [
        '<tools>',
        '- read: Read file contents',
        '- tool_search: Search for tools that are not loaded yet and load the matches',
        '',
        '<deferred_tools>',
        `  <instructions>${DEFERRED_INSTRUCTIONS}</instructions>`,
        '  - web_fetch: Fetch a web page and return clean markdown content',
        '  - web_search: Search the web',
        '</deferred_tools>',
        '',
        'Additional tools may be available.',
        '</tools>',
      ].join('\n'),
    );
  });

  it('omits deferred tools that are already loaded', () => {
    const tools = toolsSection({
      selectedTools: ['read', 'tool_search', 'web_fetch'],
      deferredTools: ['web_fetch', 'web_search'],
    });

    expect(tools).toContain('- web_fetch: Fetch a web page and return clean markdown content\n\n<deferred_tools>');
    expect(tools).toContain(`</instructions>\n  - web_search: Search the web\n</deferred_tools>`);
  });

  it('leaves the block out when tool_search is not declared', () => {
    const withoutToolSearch = toolsSection({ selectedTools: ['read'], deferredTools: ['web_fetch'] });
    const hiddenToolSearch = toolsSection({
      selectedTools: ['read', 'tool_search'],
      hiddenTools: ['tool_search'],
      deferredTools: ['web_fetch'],
    });

    expect(withoutToolSearch).toBe(
      '<tools>\n- read: Read file contents\n\nAdditional tools may be available.\n</tools>',
    );
    expect(hiddenToolSearch).toBe(withoutToolSearch);
  });

  it('leaves the block out when every deferred tool is loaded', () => {
    const expected =
      '<tools>\n- read: Read file contents\n' +
      '- tool_search: Search for tools that are not loaded yet and load the matches\n' +
      '- web_fetch: Fetch a web page and return clean markdown content\n\nAdditional tools may be available.\n</tools>';

    expect(toolsSection({ selectedTools: ['read', 'tool_search', 'web_fetch'], deferredTools: ['web_fetch'] })).toBe(
      expected,
    );
    expect(toolsSection({ selectedTools: ['read', 'tool_search', 'web_fetch'] })).toBe(expected);
  });

  it('lists a deferred tool without a snippet by its name alone', () => {
    const tools = toolsSection({ selectedTools: ['tool_search'], deferredTools: ['bare_tool'] });

    expect(tools).toContain('</instructions>\n  - bare_tool\n</deferred_tools>');
  });
});
