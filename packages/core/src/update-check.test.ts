import { describe, expect, it, vi } from 'vitest';
import { checkForUpdates, checkNpmVersion, getInstallCommand } from './update-check.js';

describe('update-check', () => {
  describe('checkNpmVersion', () => {
    it('returns undefined when registry version matches current version', async () => {
      const fetchImpl = vi.fn(async () => ({
        ok: true,
        json: async () => ({ version: '1.2.3' }),
      }));

      await expect(checkNpmVersion('example', '1.2.3', fetchImpl)).resolves.toBeUndefined();
    });

    it('returns the latest version when it differs', async () => {
      const fetchImpl = vi.fn(async () => ({
        ok: true,
        json: async () => ({ version: '1.2.4' }),
      }));

      await expect(checkNpmVersion('example', '1.2.3', fetchImpl)).resolves.toBe('1.2.4');
    });
  });

  describe('getInstallCommand', () => {
    it('uses bun when bun is detected', () => {
      expect(getInstallCommand('example', { bunVersion: '1.3.11' })).toBe('bun install -g example');
    });

    it('falls back to npm when bun is not detected', () => {
      expect(getInstallCommand('example', { bunVersion: undefined })).toBe('npm install -g example');
    });
  });

  describe('checkForUpdates', () => {
    it('reports a pi update when the registry returns a newer version', async () => {
      const fetchImpl = vi.fn(async () => ({
        ok: true,
        json: async () => ({ version: '0.65.0' }),
      }));

      const updates = await checkForUpdates(
        {
          piCodingAgentVersion: '0.64.0',
          bunVersion: '1.3.11',
        },
        fetchImpl,
      );

      expect(updates).toEqual([
        {
          name: 'pi-coding-agent',
          currentVersion: '0.64.0',
          latestVersion: '0.65.0',
          installCommand: 'bun install -g @mariozechner/pi-coding-agent',
          changelogUrl: 'https://github.com/badlogic/pi-mono/blob/main/packages/coding-agent/CHANGELOG.md',
        },
      ]);
    });

    it('returns no updates when version info is unavailable or fetch fails', async () => {
      const fetchImpl = vi.fn(async () => {
        throw new Error('offline');
      });

      await expect(checkForUpdates({}, fetchImpl)).resolves.toEqual([]);
    });
  });
});
