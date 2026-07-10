import { describe, expect, it, vi } from 'vitest';
import { buildSandpiperStartupPrompt, type StartupPromptDependencies } from './startup-prompt.js';

function createDependencies(overrides: Partial<StartupPromptDependencies> = {}): StartupPromptDependencies {
  return {
    buildSystemPrompt: vi.fn(async (options) => JSON.stringify(options)),
    detectVersionControl: vi.fn(() => ({ system: 'none' as const, detection: 'session_start' as const })),
    env: {
      PI_CODING_AGENT_PACKAGE: '/pi/package',
      PI_CODING_AGENT_VERSION: '1.2.3',
      SANDPIPER_CODING_AGENT_PACKAGE: '/sandpiper/package',
    },
    fileExists: vi.fn(() => false),
    readFile: vi.fn(() => ''),
    readUserProfile: vi.fn(() => ''),
    ...overrides,
  };
}

describe('startup prompt operations', () => {
  it('returns undefined for custom prompts', async () => {
    const prompt = await buildSandpiperStartupPrompt(
      { cwd: '/repo', systemPromptOptions: { cwd: '/repo', customPrompt: 'custom' } },
      createDependencies(),
    );

    expect(prompt).toBeUndefined();
  });

  it('builds prompt context from cwd, package metadata, and version control', async () => {
    const dependencies = createDependencies({
      detectVersionControl: vi.fn(() => ({
        system: 'jj' as const,
        colocatedGit: true,
        detection: 'session_start' as const,
      })),
      fileExists: vi.fn(() => true),
    });

    const prompt = await buildSandpiperStartupPrompt(
      { agentDir: '/agent', cwd: '/repo', systemPromptOptions: { cwd: '/repo' } },
      dependencies,
    );

    expect(prompt).toContain('"cwd":"/repo"');
    expect(prompt).toContain('"piCodingAgentPackage":"/pi/package"');
    expect(prompt).toContain('"piCodingAgentVersion":"1.2.3"');
    expect(prompt).toContain('"sandpiperCodingAgentPackage":"/sandpiper/package"');
    expect(prompt).toContain('"userProfile":""');
    expect(prompt).toContain('"versionControl":{"system":"jj","colocatedGit":true,"detection":"session_start"}');
  });

  it('passes the user profile into system prompt construction', async () => {
    const dependencies = createDependencies({
      readUserProfile: vi.fn(() => '# User\nLikes plans'),
    });

    const prompt = await buildSandpiperStartupPrompt(
      { agentDir: '/agent', cwd: '/repo', systemPromptOptions: { cwd: '/repo' } },
      dependencies,
    );

    expect(dependencies.readUserProfile).toHaveBeenCalledWith({
      agentDir: '/agent',
      fileExists: dependencies.fileExists,
      readFile: dependencies.readFile,
    });
    expect(prompt).toContain('"userProfile":"# User\\nLikes plans"');
  });
});
