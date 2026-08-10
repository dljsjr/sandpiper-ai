import { execFileSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { findPackageRoot } from './standalone_bootstrap.js';

const repoRoot = findPackageRoot(dirname(fileURLToPath(import.meta.url)), 'sandpiper-ai');
const bunExecutable = process.env.BUN_EXECUTABLE ?? 'bun';

function diagnosticEnv(agentDir: string): NodeJS.ProcessEnv {
  const testRoot = dirname(agentDir);
  const env: NodeJS.ProcessEnv = {
    ...process.env,
    HOME: join(testRoot, 'home'),
    XDG_CONFIG_HOME: join(testRoot, 'config'),
    XDG_STATE_HOME: join(testRoot, 'state'),
    PI_OFFLINE: '1',
    SANDPIPER_CODING_AGENT_DIR: agentDir,
    SANDPIPER_SESSION_DIR: join(agentDir, 'sessions'),
    SANDPIPER_STANDALONE_PACKAGE_DIR: join(testRoot, 'standalone-package'),
    SANDPIPER_STANDALONE_RESOURCE_ROOT: repoRoot,
  };
  delete env.PI_PACKAGE_DIR;
  delete env.PI_CODING_AGENT_PACKAGE;
  delete env.PI_CODING_AGENT_VERSION;
  delete env.SANDPIPER_CODING_AGENT_PACKAGE;
  return env;
}

describe('system prompt diagnostic', () => {
  it('renders the complete prompt without making a provider request', () => {
    const tempDir = mkdtempSync(join(tmpdir(), 'sandpiper-system-prompt-'));
    const agentDir = join(tempDir, 'agent');
    const providerProbe = join(tempDir, 'provider-probe.ts');
    mkdirSync(agentDir, { recursive: true });
    mkdirSync(join(tempDir, 'home'), { recursive: true });
    writeFileSync(
      providerProbe,
      `export default function providerProbe(pi) {
  pi.on('before_provider_request', () => process.exit(97));
}
`,
    );

    try {
      const output = execFileSync(
        bunExecutable,
        [
          'run',
          '--bun',
          './packages/cli/sandpiper_system_prompt.ts',
          '--approve',
          '--extension',
          providerProbe,
          '--identity',
          '<identity>diagnostic identity</identity>',
          '--append-system-prompt',
          '<birdup>diagnostic append</birdup>',
        ],
        {
          cwd: repoRoot,
          encoding: 'utf-8',
          env: diagnosticEnv(agentDir),
          stdio: ['ignore', 'pipe', 'pipe'],
          timeout: 30_000,
        },
      );

      expect(output).toContain('<system_prompt>');
      expect(output).toContain('<identity>diagnostic identity</identity>');
      expect(output).toContain('<birdup>diagnostic append</birdup>');
      expect(output).toContain('<available_tools>');
      expect(output).toContain('<available_skills>');
      expect(output).toContain('name="tasks"');
    } finally {
      rmSync(tempDir, { recursive: true, force: true });
    }
  }, 30_000);
});
