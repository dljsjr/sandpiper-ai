import { execFileSync } from 'node:child_process';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const repoRoot = dirname(dirname(fileURLToPath(import.meta.url)));

describe('standalone Sandpiper compiled app bundle', () => {
  it('runs help from the app bundle without source-root path overrides', async () => {
    const tempDir = mkdtempSync(join(tmpdir(), 'sandpiper-standalone-app-compile-'));

    try {
      const executable = join(repoRoot, 'dist', 'standalone-sandpiper', 'sandpiper');
      const agentDir = join(tempDir, 'agent');

      execFileSync('bun', ['run', 'build:standalone-app'], { cwd: repoRoot, stdio: 'pipe' });

      const output = execFileSync(
        executable,
        ['--help', '--no-extensions', '--no-skills', '--no-prompt-templates', '--no-themes', '--no-context-files'],
        {
          cwd: tempDir,
          encoding: 'utf-8',
          env: {
            ...process.env,
            SANDPIPER_CODING_AGENT_DIR: agentDir,
            PI_OFFLINE: '1',
          },
        },
      );

      expect(output).toContain('sandpiper - AI coding assistant');
      expect(output).toContain('--migrate-pi-configs');
      expect(output).toContain('using pi-coding-agent version:');
    } finally {
      rmSync(tempDir, { recursive: true, force: true });
    }
  }, 20_000);
});
