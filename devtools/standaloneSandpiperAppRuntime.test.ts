import { execFileSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, rmSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { beforeAll, describe, expect, it } from 'vitest';

const repoRoot = dirname(dirname(fileURLToPath(import.meta.url)));
const executable = join(repoRoot, 'dist', 'standalone-sandpiper', 'sandpiper');

function runAppHelp(cwd: string): string {
  const tempDir = mkdtempSync(join(repoRoot, '.tmp-standalone-app-runtime-'));

  try {
    const agentDir = join(tempDir, 'agent');
    return execFileSync(executable, ['--help', '--no-context-files'], {
      cwd,
      encoding: 'utf-8',
      env: {
        ...process.env,
        SANDPIPER_CODING_AGENT_DIR: agentDir,
        PI_OFFLINE: '1',
      },
    });
  } finally {
    rmSync(tempDir, { recursive: true, force: true });
  }
}

function countFlagLines(output: string, flag: string): number {
  return output.split('\n').filter((line) => line.trimStart().startsWith(flag)).length;
}

describe('standalone Sandpiper app runtime smoke', () => {
  beforeAll(() => {
    execFileSync('bun', ['run', 'build:standalone-app'], { cwd: repoRoot, stdio: 'pipe' });
  }, 20_000);

  it('loads bundled resources and extension flags from a temp project directory', () => {
    const tempDir = mkdtempSync(join(repoRoot, '.tmp-standalone-app-project-'));

    try {
      const projectDir = join(tempDir, 'project');
      mkdirSync(projectDir, { recursive: true });

      const output = runAppHelp(projectDir);

      expect(output).toContain('sandpiper - AI coding assistant');
      expect(countFlagLines(output, '--migrate-pi-configs')).toBe(1);
      expect(countFlagLines(output, '--install-shell-integrations')).toBe(1);
    } finally {
      rmSync(tempDir, { recursive: true, force: true });
    }
  });

  it('runs from the source repo cwd without source-root path overrides', () => {
    const output = runAppHelp(repoRoot);

    expect(output).toContain('sandpiper - AI coding assistant');
    expect(countFlagLines(output, '--migrate-pi-configs')).toBe(1);
    expect(countFlagLines(output, '--install-shell-integrations')).toBe(1);
  });
});
