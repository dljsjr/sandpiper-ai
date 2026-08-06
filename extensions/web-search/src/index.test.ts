import type { ExtensionAPI } from '@earendil-works/pi-coding-agent';
import { describe, expect, it, vi } from 'vitest';
import init from './index.js';
import type { SearchAdapter } from './types.js';

function fakeAdapter(): SearchAdapter {
  return { name: 'fake', search: vi.fn(async () => []) };
}

describe('web-search extension', () => {
  it('prefers strict JSON-schema sampling', async () => {
    const registerTool = vi.fn();
    const pi = { registerTool } as unknown as ExtensionAPI;

    await init(pi, { adapter: fakeAdapter() });

    const tool = registerTool.mock.calls[0]?.[0] as { readonly constrainedSampling?: unknown };
    expect(tool.constrainedSampling).toEqual({ type: 'json_schema', strict: 'prefer' });
  });
});
