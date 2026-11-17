import { mkdirSync, mkdtempSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { getCurrentTools } from '@earendil-works/pi-ai';
import { createToolSearchExtension, type ExtensionFactory, SessionManager } from '@earendil-works/pi-coding-agent';
import { Type } from 'typebox';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
// Pi does not export the prompt builder; this is the installed module that Sandpiper's local patch changes.
import {
  type BuildSystemPromptOptions,
  buildSystemPromptSections,
} from '../../node_modules/@earendil-works/pi-coding-agent/dist/core/system-prompt.js';
import webFetchExtension from '../web-fetch/src/index.js';
import { createRendererExtension } from '../web-fetch/src/renderer-extensions.js';
import { registerDeferredToolHooks } from './deferred-tools.js';
import {
  createPromptRecordingSession,
  type PromptRecordingSession,
  type RecordedRequest,
} from './prompt-recording-harness.js';
import { registerStartupPromptHooks } from './startup-hooks.js';

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

const deferredProbeExtension: ExtensionFactory = (pi) => {
  for (const [name, snippet] of [
    ['deferred_probe', 'Report the probe state'],
    ['idle_helper', 'Wait for nothing'],
  ] as const) {
    pi.registerTool({
      name,
      label: name,
      description: `${snippet}.`,
      promptSnippet: snippet,
      exposure: 'deferred',
      parameters: Type.Object({}),
      async execute() {
        return { content: [{ type: 'text', text: snippet }], details: undefined };
      },
    });
  }
};

const sandpiperExtensions: readonly ExtensionFactory[] = [
  (pi) => registerStartupPromptHooks(pi),
  (pi) => registerDeferredToolHooks(pi),
  createToolSearchExtension(),
  deferredProbeExtension,
];

let root: string;
let open: PromptRecordingSession[] = [];

async function startSession(
  options: Partial<Parameters<typeof createPromptRecordingSession>[0]> = {},
): Promise<PromptRecordingSession> {
  const recording = await createPromptRecordingSession({
    cwd: join(root, 'project'),
    agentDir: join(root, 'agent'),
    extensions: sandpiperExtensions,
    ...options,
  });
  open.push(recording);
  return recording;
}

function section(request: RecordedRequest | undefined, name: string): string {
  const systemPrompt = request?.systemPrompt ?? '';
  const start = systemPrompt.indexOf(`<${name}>`);
  const end = systemPrompt.indexOf(`</${name}>`, start);
  return start === -1 || end === -1 ? '' : systemPrompt.slice(start, end);
}

function declaredTools(request: RecordedRequest | undefined): string[] {
  return getCurrentTools(request?.messages ?? []).map((tool) => tool.name);
}

// One renderer, so web_fetch registers again on the first run with a `render` switch.
const fixtureRendererExtension = createRendererExtension(() => ({
  id: 'fixture',
  render: async () => ({ html: '<html><body>fixture</body></html>' }),
}));

describe('loading a deferred tool in a session', () => {
  beforeEach(() => {
    root = mkdtempSync(join(tmpdir(), 'sandpiper-deferred-tools-'));
    mkdirSync(join(root, 'project'));
    mkdirSync(join(root, 'agent'));
    mkdirSync(join(root, 'home'));
    vi.stubEnv('HOME', join(root, 'home'));
    vi.stubEnv('PI_CODING_AGENT_DIR', join(root, 'agent'));
  });

  afterEach(() => {
    for (const recording of open) recording.dispose();
    open = [];
    vi.unstubAllEnvs();
    rmSync(root, { recursive: true, force: true });
  });

  it('moves a tool that tool_search loads from the deferred block to the declared tools', async () => {
    const recording = await startSession({
      responses: [{ toolCall: 'tool_search', arguments: { query: 'deferred_probe' } }, 'text'],
    });

    await recording.prompt('hello');

    const [first, second] = recording.requests;
    expect(declaredTools(first)).toContain('tool_search');
    expect(declaredTools(first)).not.toContain('deferred_probe');
    expect(section(first, 'deferred_tools')).toContain('  - deferred_probe: Report the probe state');
    expect(section(first, 'deferred_tools')).toContain('  - idle_helper: Wait for nothing');

    expect(declaredTools(second)).toContain('deferred_probe');
    expect(declaredTools(second)).not.toContain('idle_helper');
    expect(section(second, 'tools')).toContain('\n- deferred_probe: Report the probe state\n');
    expect(section(second, 'deferred_tools')).not.toContain('deferred_probe');
    expect(section(second, 'deferred_tools')).toContain('  - idle_helper: Wait for nothing');
  });

  it('keeps web_fetch loaded after resuming, when it registers again on the first run', async () => {
    const sessionDir = join(root, 'sessions');
    const extensions = [...sandpiperExtensions, webFetchExtension, fixtureRendererExtension];
    const first = await startSession({
      extensions,
      sessionManager: SessionManager.create(join(root, 'project'), sessionDir),
      responses: [{ toolCall: 'tool_search', arguments: { query: 'web_fetch' } }, 'text'],
    });
    await first.prompt('hello');
    expect(declaredTools(first.requests[1])).toContain('web_fetch');
    first.dispose();
    open = [];
    const [sessionFile] = readdirSync(sessionDir);

    const resumed = await startSession({
      extensions,
      sessionManager: SessionManager.open(join(sessionDir, sessionFile ?? ''), sessionDir),
    });
    expect(resumed.extensionApi.getActiveTools()).toContain('web_fetch');
    // Registered at load without the renderer's switch, so far.
    expect(resumed.session.getToolDefinition('web_fetch')?.parameters).not.toHaveProperty('properties.render');

    await resumed.prompt('after resume');

    const [request] = resumed.requests;
    expect(resumed.session.getToolDefinition('web_fetch')?.parameters).toHaveProperty('properties.render');
    expect(resumed.extensionApi.getActiveTools()).toContain('web_fetch');
    expect(declaredTools(request)).toContain('web_fetch');
    expect(section(request, 'tools')).toContain('\n- web_fetch: ');
    expect(section(request, 'deferred_tools')).not.toContain('web_fetch');
  });

  it('lists deferred tools under a user custom prompt', async () => {
    writeFileSync(join(root, 'agent', 'SYSTEM.md'), 'Custom user prompt.');
    const recording = await startSession();

    await recording.prompt('hello');

    const [request] = recording.requests;
    expect(request?.systemPrompt.startsWith('Custom user prompt.')).toBe(true);
    expect(section(request, 'deferred_tools')).toContain('  - deferred_probe: Report the probe state');
  });
});
