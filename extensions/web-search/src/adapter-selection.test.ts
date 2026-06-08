/**
 * Tests for provider selection + Brave key resolution.
 * Mocks readSettingsKey so we exercise the settings-path logic without real files.
 * (This is the test that would have caught the nested-key bug.)
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('./config-resolver.js', async (importOriginal) => {
  const actual = await importOriginal<typeof import('./config-resolver.js')>();
  return { ...actual, readSettingsKey: vi.fn() };
});

import { resolveBraveKey, selectSearchAdapter } from './adapter-selection.js';
import { BraveSearchAdapter } from './brave-adapter.js';
import { readSettingsKey } from './config-resolver.js';
import { ParallelMcpSearchAdapter } from './parallel-adapter.js';

const mockReadSettings = vi.mocked(readSettingsKey);
const savedEnvKey = process.env.BRAVE_API_KEY;

beforeEach(() => {
  mockReadSettings.mockReset();
  delete process.env.BRAVE_API_KEY;
});

afterEach(() => {
  if (savedEnvKey === undefined) delete process.env.BRAVE_API_KEY;
  else process.env.BRAVE_API_KEY = savedEnvKey;
});

describe('resolveBraveKey', () => {
  it('reads a literal key from settings web-search.braveApiKey (the real config location)', () => {
    mockReadSettings.mockImplementation((k) => (k === 'web-search' ? { braveApiKey: 'sk-nested' } : undefined));
    expect(resolveBraveKey()).toBe('sk-nested');
  });

  it('reads from the camelCase webSearch namespace too', () => {
    mockReadSettings.mockImplementation((k) => (k === 'webSearch' ? { braveApiKey: 'sk-camel' } : undefined));
    expect(resolveBraveKey()).toBe('sk-camel');
  });

  it('reads a top-level braveApiKey fallback', () => {
    mockReadSettings.mockImplementation((k) => (k === 'braveApiKey' ? 'sk-top' : undefined));
    expect(resolveBraveKey()).toBe('sk-top');
  });

  it('prefers the BRAVE_API_KEY env var over settings', () => {
    process.env.BRAVE_API_KEY = 'sk-env';
    mockReadSettings.mockImplementation((k) => (k === 'web-search' ? { braveApiKey: 'sk-settings' } : undefined));
    expect(resolveBraveKey()).toBe('sk-env');
  });

  it('returns undefined when nothing is configured', () => {
    mockReadSettings.mockReturnValue(undefined);
    expect(resolveBraveKey()).toBeUndefined();
  });
});

describe('selectSearchAdapter', () => {
  it('returns the explicitly injected adapter when provided', () => {
    const fake = { name: 'fake', search: async () => [] };
    expect(selectSearchAdapter(fake)).toBe(fake);
  });

  it('returns Brave when a key resolves from web-search.braveApiKey', () => {
    mockReadSettings.mockImplementation((k) => (k === 'web-search' ? { braveApiKey: 'sk-nested' } : undefined));
    expect(selectSearchAdapter()).toBeInstanceOf(BraveSearchAdapter);
  });

  it('falls back to Parallel (free, no-key) when no key is configured', () => {
    mockReadSettings.mockReturnValue(undefined);
    expect(selectSearchAdapter()).toBeInstanceOf(ParallelMcpSearchAdapter);
  });
});
