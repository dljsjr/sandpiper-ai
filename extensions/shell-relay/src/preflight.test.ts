import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { checkShellIntegration } from './preflight.js';

describe('checkShellIntegration', () => {
  describe('with a recognized shell', () => {
    it('returns healthy when the probe reports the integration is active', () => {
      const result = checkShellIntegration({
        shellPath: '/usr/bin/fish',
        probeShellFunction: () => true,
      });

      expect(result).toEqual({
        key: 'shell-relay:integration',
        healthy: true,
        message: 'Shell integration is active',
      });
    });

    it('returns unhealthy with sourcing instructions when the probe reports the integration is not sourced', () => {
      const result = checkShellIntegration({
        shellPath: '/usr/bin/fish',
        probeShellFunction: () => false,
        wellKnownDir: '/tmp/shell-integrations',
      });

      expect(result.key).toBe('shell-relay:integration');
      expect(result.healthy).toBe(false);
      expect(result.message).toContain('not sourced');
      expect(result.instructions).toContain('Add to ~/.config/fish/config.fish:');
      expect(result.instructions).toContain('  source /tmp/shell-integrations/relay.fish');
    });
  });

  describe('with file existence fallback', () => {
    let tempDir: string;

    beforeEach(() => {
      tempDir = mkdtempSync(join(tmpdir(), 'preflight-test-'));
    });

    afterEach(() => {
      rmSync(tempDir, { recursive: true, force: true });
    });

    it('returns unhealthy when no scripts are installed at the target location', () => {
      const result = checkShellIntegration({
        shellPath: '/usr/bin/nushell',
        wellKnownDir: tempDir,
      });

      expect(result.key).toBe('shell-relay:integration');
      expect(result.healthy).toBe(false);
      expect(result.message).toContain('not installed');
      expect(result.instructions?.some((instruction) => instruction.includes('--install-shell-integrations'))).toBe(
        true,
      );
    });

    it('returns healthy when at least one script exists at the target location', () => {
      writeFileSync(join(tempDir, 'relay.fish'), '# test stub');

      const result = checkShellIntegration({
        shellPath: '/usr/bin/nushell',
        wellKnownDir: tempDir,
      });

      expect(result.key).toBe('shell-relay:integration');
      expect(result.healthy).toBe(true);
    });
  });

  it('uses process.env.SHELL by default', () => {
    const originalShell = process.env.SHELL;
    process.env.SHELL = '/usr/bin/zsh';

    try {
      const result = checkShellIntegration({
        probeShellFunction: () => false,
        wellKnownDir: '/tmp/shell-integrations',
      });

      expect(result.instructions).toContain('Add to ~/.zshrc:');
      expect(result.instructions).toContain('  source /tmp/shell-integrations/relay.zsh');
    } finally {
      if (originalShell === undefined) {
        delete process.env.SHELL;
      } else {
        process.env.SHELL = originalShell;
      }
    }
  });

  it('always returns a valid PreflightDiagnostic shape', () => {
    const result = checkShellIntegration({
      shellPath: '/usr/bin/nushell',
      wellKnownDir: '/tmp/nowhere',
    });

    expect(typeof result.key).toBe('string');
    expect(typeof result.healthy).toBe('boolean');
    expect(typeof result.message).toBe('string');
    if (result.instructions !== undefined) {
      expect(Array.isArray(result.instructions)).toBe(true);
    }
  });
});
