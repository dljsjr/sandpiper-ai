import { existsSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import type { ExtensionAPI, ExtensionToolContext } from '@earendil-works/pi-coding-agent';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { WebSearchToolInput, WebSearchToolResult } from './tool-operation.js';
import type { SearchAdapter } from './types.js';

const mocks = vi.hoisted(() => ({ agentDir: '' }));

vi.mock('@earendil-works/pi-coding-agent', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@earendil-works/pi-coding-agent')>()),
  getAgentDir: () => mocks.agentDir,
}));

import init from './index.js';

interface RegisteredWebSearchTool {
  execute(
    toolCallId: string,
    params: WebSearchToolInput,
    signal: undefined,
    onUpdate: undefined,
    ctx: ExtensionToolContext,
  ): Promise<WebSearchToolResult>;
}

let root: string;
let cwd: string;

beforeEach(() => {
  root = mkdtempSync(join(tmpdir(), 'web-search-trust-'));
  cwd = join(root, 'project');
  mocks.agentDir = join(root, 'agent');
  mkdirSync(join(cwd, '.sandpiper'), { recursive: true });
  mkdirSync(mocks.agentDir);
  vi.stubEnv('BRAVE_API_KEY', '');
  vi.spyOn(process, 'cwd').mockReturnValue(cwd);
});

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllEnvs();
  rmSync(root, { recursive: true, force: true });
});

async function runSearch(trusted: boolean) {
  let tool: RegisteredWebSearchTool | undefined;
  const pi = {
    registerTool: (registered: RegisteredWebSearchTool) => {
      tool = registered;
    },
  } as unknown as ExtensionAPI;
  const execute = vi.fn(async (adapter: SearchAdapter) => ({
    content: [],
    details: { query: 'test', provider: adapter.name, resultCount: 0 },
  }));
  await init(pi, { executeWebSearchTool: execute });
  const ctx = { cwd, isProjectTrusted: () => trusted } as ExtensionToolContext;
  await tool?.execute('call', { query: 'test' }, undefined, undefined, ctx);
  return execute;
}

function writeKey(directory: string, key: string) {
  writeFileSync(join(directory, 'settings.json'), JSON.stringify({ 'web-search': { braveApiKey: key } }));
}

describe('web-search project trust', () => {
  it('never runs a command from untrusted project settings', async () => {
    const marker = join(root, 'project-command-ran');
    writeKey(join(cwd, '.sandpiper'), `!printf ran > '${marker}'; printf project-key`);

    const execute = await runSearch(false);

    expect(existsSync(marker)).toBe(false);
    expect(execute.mock.calls[0]?.[0].name).toBe('parallel');
  });

  it('runs a trusted project command from the tool context working directory', async () => {
    const marker = join(root, 'trusted-command-ran');
    writeKey(join(cwd, '.sandpiper'), `!printf ran > '${marker}'; printf project-key`);
    vi.mocked(process.cwd).mockReturnValue(root);

    const execute = await runSearch(true);

    expect(existsSync(marker)).toBe(true);
    expect(execute.mock.calls[0]?.[0].name).toBe('brave');
  });

  it('resolves agent commands without trusting the project', async () => {
    const projectMarker = join(root, 'project-command-ran');
    const agentMarker = join(root, 'agent-command-ran');
    writeKey(join(cwd, '.sandpiper'), `!printf ran > '${projectMarker}'; printf project-key`);
    writeKey(mocks.agentDir, `!printf ran > '${agentMarker}'; printf agent-key`);

    const execute = await runSearch(false);

    expect(existsSync(projectMarker)).toBe(false);
    expect(existsSync(agentMarker)).toBe(true);
    expect(execute.mock.calls[0]?.[0].name).toBe('brave');
  });

  it('resolves environment commands before either settings file', async () => {
    const envMarker = join(root, 'env-command-ran');
    const settingsMarker = join(root, 'settings-command-ran');
    vi.stubEnv('BRAVE_API_KEY', `!printf ran > '${envMarker}'; printf env-key`);
    writeKey(join(cwd, '.sandpiper'), `!printf ran > '${settingsMarker}'; printf project-key`);
    writeKey(mocks.agentDir, `!printf ran > '${settingsMarker}'; printf agent-key`);

    const execute = await runSearch(false);

    expect(existsSync(envMarker)).toBe(true);
    expect(existsSync(settingsMarker)).toBe(false);
    expect(execute.mock.calls[0]?.[0].name).toBe('brave');
  });

  it('reselects when Pi reinitializes the extension with a different trust decision', async () => {
    writeKey(join(cwd, '.sandpiper'), 'project-key');

    const trusted = await runSearch(true);
    const untrusted = await runSearch(false);
    const trustedAgain = await runSearch(true);

    expect(trusted.mock.calls[0]?.[0].name).toBe('brave');
    expect(untrusted.mock.calls[0]?.[0].name).toBe('parallel');
    expect(trustedAgain.mock.calls[0]?.[0].name).toBe('brave');
  });
});
