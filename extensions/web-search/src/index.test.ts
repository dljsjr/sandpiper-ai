import type { ExtensionAPI } from '@earendil-works/pi-coding-agent';
import { describe, expect, it, vi } from 'vitest';
import type { WebSearchToolInput, WebSearchToolResult } from './tool-operation.js';
import type { SearchAdapter } from './types.js';

const mocks = vi.hoisted(() => ({
  selectSearchAdapter: vi.fn(),
}));

vi.mock('./adapter-selection.js', () => ({
  selectSearchAdapter: mocks.selectSearchAdapter,
}));

import init from './index.js';

interface RegisteredWebSearchTool {
  execute(toolCallId: string, params: WebSearchToolInput): Promise<WebSearchToolResult>;
}

describe('web-search extension', () => {
  it('selects the default adapter on first execution and reuses it', async () => {
    const adapter: SearchAdapter = {
      name: 'fake',
      search: vi.fn(async () => []),
    };
    mocks.selectSearchAdapter.mockReturnValue(adapter);
    let registeredTool: RegisteredWebSearchTool | undefined;
    const pi = {
      registerTool: vi.fn((tool: RegisteredWebSearchTool) => {
        registeredTool = tool;
      }),
    } as unknown as ExtensionAPI;

    await init(pi);

    expect(mocks.selectSearchAdapter).not.toHaveBeenCalled();

    await registeredTool?.execute('call-1', { query: 'first' });
    await registeredTool?.execute('call-2', { query: 'second' });

    expect(mocks.selectSearchAdapter).toHaveBeenCalledTimes(1);
    expect(adapter.search).toHaveBeenCalledTimes(2);
  });
});
