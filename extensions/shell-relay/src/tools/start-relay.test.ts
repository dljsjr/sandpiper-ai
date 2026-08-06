import type { ExtensionAPI } from '@earendil-works/pi-coding-agent';
import { describe, expect, it, vi } from 'vitest';
import type { RelayRuntime } from '../types.js';
import { registerStartRelayTool } from './start-relay.js';

describe('registerStartRelayTool', () => {
  it('prefers strict JSON-schema sampling', () => {
    const registerTool = vi.fn();
    const pi = { registerTool } as unknown as ExtensionAPI;
    const runtime = {} as RelayRuntime;

    registerStartRelayTool(pi, runtime);

    const tool = registerTool.mock.calls[0]?.[0] as { readonly constrainedSampling?: unknown };
    expect(tool.constrainedSampling).toEqual({ type: 'json_schema', strict: 'prefer' });
  });
});
