import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { checkShellIntegration } from './preflight.js';

describe('checkShellIntegration', () => {
  describe('with fish shell (live probe)', () => {
    let originalShell: string | undefined;

    beforeEach(() => {
      originalShell = process.env.SHELL;
      process.env.SHELL = '/usr/bin/fish';
    });

    afterEach(() => {
      if (originalShell === undefined) {
        delete process.env.SHELL;
      } else {
        process.env.SHELL = originalShell;
      }
    });

    it('returns healthy when __relay_prompt_hook is defined in fish', () => {
      const result = checkShellIntegration();
      expect(result).toHaveProperty('key', 'shell-relay:integration');
      expect(result).toHaveProperty('healthy');
      expect(result).toHaveProperty('message');
    });
  });

  describe('with unrecognized shell (file existence fallback)', () => {
    let originalShell: string | undefined;
    let tempDir: string;

    beforeEach(() => {
      originalShell = process.env.SHELL;
      process.env.SHELL = '/usr/bin/nushell';
      tempDir = mkdtempSync(join(tmpdir(), 'preflight-test-'));
    });

    afterEach(() => {
      if (originalShell === undefined) {
        delete process.env.SHELL;
      } else {
        process.env.SHELL = originalShell;
      }
      rmSync(tempDir, { recursive: true, force: true });
    });

    it('returns unhealthy when no scripts installed at well-known location', () => {
      const result = checkShellIntegration(tempDir);
      expect(result.key).toBe('shell-relay:integration');
      expect(result.healthy).toBe(false);
      expect(result.message).toContain('not installed');
      expect(result.instructions?.some((i) => i.includes('--install-shell-integrations'))).toBe(true);
    });

    it('returns healthy when at least one script exists at well-known location', () => {
      writeFileSync(join(tempDir, 'relay.fish'), '# test stub');

      const result = checkShellIntegration(tempDir);
      expect(result.key).toBe('shell-relay:integration');
      expect(result.healthy).toBe(true);
    });
  });

  describe('with no SHELL env var', () => {
    let originalShell: string | undefined;
    let tempDir: string;

    beforeEach(() => {
      originalShell = process.env.SHELL;
      delete process.env.SHELL;
      tempDir = mkdtempSync(join(tmpdir(), 'preflight-test-'));
    });

    afterEach(() => {
      if (originalShell !== undefined) {
        process.env.SHELL = originalShell;
      }
      rmSync(tempDir, { recursive: true, force: true });
    });

    it('falls back to file existence check', () => {
      const result = checkShellIntegration(tempDir);
      expect(result.key).toBe('shell-relay:integration');
      expect(result.healthy).toBe(false);
    });
  });

  it('always returns a valid PreflightDiagnostic shape', () => {
    const result = checkShellIntegration();
    expect(typeof result.key).toBe('string');
    expect(typeof result.healthy).toBe('boolean');
    expect(typeof result.message).toBe('string');
    if (result.instructions !== undefined) {
      expect(Array.isArray(result.instructions)).toBe(true);
    }
  });
});
