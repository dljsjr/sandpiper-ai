import { join } from 'node:path';
import { describe, expect, it, vi } from 'vitest';
import { getSandpiperUserProfilePath, readSandpiperUserProfile } from './user-profile.js';

describe('getSandpiperUserProfilePath', () => {
  it('resolves USER.md inside the caller-provided agent directory', () => {
    expect(getSandpiperUserProfilePath('/agent')).toBe(join('/agent', 'USER.md'));
  });
});

describe('readSandpiperUserProfile', () => {
  it('returns empty content when no agent dir is provided', () => {
    expect(
      readSandpiperUserProfile({
        fileExists: vi.fn(() => true),
        readFile: vi.fn(() => '# User'),
      }),
    ).toBe('');
  });

  it('returns empty content when USER.md does not exist', () => {
    expect(
      readSandpiperUserProfile({
        agentDir: '/agent',
        fileExists: vi.fn(() => false),
        readFile: vi.fn(() => '# User'),
      }),
    ).toBe('');
  });

  it('reads USER.md when present', () => {
    const readFile = vi.fn(() => '# User\nPrefers concise updates');

    expect(
      readSandpiperUserProfile({
        agentDir: '/agent',
        fileExists: vi.fn(() => true),
        readFile,
      }),
    ).toBe('# User\nPrefers concise updates');
    expect(readFile).toHaveBeenCalledWith(join('/agent', 'USER.md'));
  });

  it('returns empty content when USER.md cannot be read', () => {
    expect(
      readSandpiperUserProfile({
        agentDir: '/agent',
        fileExists: vi.fn(() => true),
        readFile: vi.fn(() => {
          throw new Error('permission denied');
        }),
      }),
    ).toBe('');
  });
});
