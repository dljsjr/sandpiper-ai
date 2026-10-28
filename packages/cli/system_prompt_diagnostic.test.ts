import { execFileSync, spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
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
    SANDPIPER_STANDALONE_RESOURCE_ROOT: join(repoRoot, 'packages', 'resources'),
  };
  delete env.PI_PACKAGE_DIR;
  delete env.PI_CODING_AGENT_PACKAGE;
  delete env.PI_CODING_AGENT_VERSION;
  delete env.SANDPIPER_CODING_AGENT_PACKAGE;
  return env;
}

describe('system prompt diagnostic', () => {
  it('renders the complete prompt without resolving configured credentials or making a provider request', () => {
    const tempDir = mkdtempSync(join(tmpdir(), 'sandpiper-system-prompt-'));
    const agentDir = join(tempDir, 'agent');
    const credentialProbe = join(tempDir, 'credential-read');
    const providerProbe = join(tempDir, 'provider-probe.ts');
    mkdirSync(agentDir, { recursive: true });
    mkdirSync(join(tempDir, 'home'), { recursive: true });
    const credentialCommand = [
      JSON.stringify(process.execPath),
      '-e',
      JSON.stringify(`require('node:fs').writeFileSync(${JSON.stringify(credentialProbe)}, 'credential resolved')`),
    ].join(' ');
    writeFileSync(
      join(agentDir, 'auth.json'),
      `${JSON.stringify({ anthropic: { type: 'api_key', key: `!${credentialCommand}` } }, null, 2)}\n`,
    );
    writeFileSync(
      join(agentDir, 'models.json'),
      `${JSON.stringify({ providers: { anthropic: { apiKey: `!${credentialCommand}` } } }, null, 2)}\n`,
    );
    writeFileSync(
      join(agentDir, 'settings.json'),
      `${JSON.stringify({ 'web-search': { braveApiKey: `!${credentialCommand}` } }, null, 2)}\n`,
    );
    writeFileSync(
      providerProbe,
      `export default function providerProbe(pi) {
  pi.on('before_provider_request', () => process.exit(97));
  pi.on('before_agent_start', (event) => {
    event.systemPromptOptions.sections.diagnostic_probe = 'extension section text';
  });
  // Terminal notification extensions write escapes like this one when a turn ends.
  pi.on('agent_end', () => {
    process.stdout.write('\\x1b]777;notify;probe;\\x07');
  });
}
`,
    );

    try {
      const run = spawnSync(
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
      const output = run.stdout;

      expect(run.status).toBe(0);
      expect(run.stderr).not.toContain(']777;notify');
      expect(output.startsWith('<system_prompt>')).toBe(true);
      expect(output).toContain('<identity>diagnostic identity</identity>');
      expect(output).toContain(`</system_prompt>\n\n`);
      expect(output).toContain(`<cwd>\n${repoRoot}\n</cwd>`);
      expect(output).toContain('<diagnostic_probe>\nextension section text\n</diagnostic_probe>');
      expect(output).toContain('<birdup>diagnostic append</birdup>');
      expect(output).toContain('<tools>\n- read:');
      expect(output).toContain('<available_skills>');
      expect(output).toContain('name="refactoring"');
      expect(output).not.toContain('<skill name="code-review"');
      expect(output).not.toContain('<skill name="tasks"');
      expect(existsSync(credentialProbe)).toBe(false);
    } finally {
      rmSync(tempDir, { recursive: true, force: true });
    }
  }, 30_000);

  it('reports file-backed prompt sources as JSON', () => {
    const tempDir = mkdtempSync(join(tmpdir(), 'sandpiper-system-prompt-sources-'));
    const agentDir = join(tempDir, 'agent');
    const contextFile = join(agentDir, 'AGENTS.md');
    const identityFile = join(tempDir, 'identity.md');
    const systemPromptFile = join(tempDir, 'system.md');
    const appendFile = join(tempDir, 'append.md');
    mkdirSync(agentDir, { recursive: true });
    mkdirSync(join(tempDir, 'home'), { recursive: true });
    writeFileSync(contextFile, '# Diagnostic context\n');
    writeFileSync(identityFile, '<identity>from file</identity>\n');
    writeFileSync(systemPromptFile, '<diagnostic_base>from file</diagnostic_base>\n');
    writeFileSync(appendFile, '<diagnostic_append>from file</diagnostic_append>\n');

    try {
      const output = execFileSync(
        bunExecutable,
        [
          'run',
          '--bun',
          './packages/cli/sandpiper_system_prompt.ts',
          '--json',
          '--approve',
          '--identity',
          identityFile,
          '--system-prompt',
          systemPromptFile,
          '--append-system-prompt',
          appendFile,
          '--append-system-prompt',
          '<diagnostic_append>raw text</diagnostic_append>',
        ],
        {
          cwd: repoRoot,
          encoding: 'utf-8',
          env: diagnosticEnv(agentDir),
          stdio: ['ignore', 'pipe', 'pipe'],
          timeout: 30_000,
        },
      );
      const result = JSON.parse(output) as {
        prompt: string;
        sources: {
          identity?: string;
          systemPrompt?: string;
          appendSystemPrompts: string[];
          contextFiles: string[];
        };
      };

      expect(result.prompt).toContain('<diagnostic_base>from file</diagnostic_base>');
      expect(result.prompt).toContain('<diagnostic_append>from file</diagnostic_append>');
      expect(result.prompt).toContain('<diagnostic_append>raw text</diagnostic_append>');
      expect(result.sources.identity).toBe(identityFile);
      expect(result.sources.systemPrompt).toBe(systemPromptFile);
      expect(result.sources.appendSystemPrompts).toEqual([appendFile]);
      expect(result.sources.contextFiles).toContain(contextFile);
    } finally {
      rmSync(tempDir, { recursive: true, force: true });
    }
  }, 30_000);
});
