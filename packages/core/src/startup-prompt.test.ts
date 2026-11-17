import { describe, expect, it, vi } from 'vitest';
import { buildSandpiperStartupPrompt, type StartupPromptDependencies } from './startup-prompt.js';
import { loadSystemPromptTemplates } from './system-prompt.js';

function createDependencies(overrides: Partial<StartupPromptDependencies> = {}): StartupPromptDependencies {
  return {
    buildSystemPrompt: vi.fn(async (options) => ({ text: JSON.stringify(options), spans: [] })),
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

  it('builds prompt context from package metadata and the version control detected in cwd', async () => {
    const dependencies = createDependencies({
      detectVersionControl: vi.fn(() => ({
        system: 'jj' as const,
        colocatedGit: true,
        detection: 'session_start' as const,
      })),
      fileExists: vi.fn(() => true),
    });

    const prompt = await buildSandpiperStartupPrompt(
      {
        agentDir: '/agent',
        cwd: '/repo',
        systemPromptOptions: { cwd: '/repo' },
        sessionStartDate: '2026-09-08',
      },
      dependencies,
    );

    expect(prompt?.text).not.toContain('"cwd"');
    expect(dependencies.detectVersionControl).toHaveBeenCalledWith('/repo', { fileExists: dependencies.fileExists });
    expect(prompt?.text).toContain('"sessionStartDate":"2026-09-08"');
    expect(prompt?.text).toContain('"piCodingAgentPackage":"/pi/package"');
    expect(prompt?.text).toContain('"piCodingAgentVersion":"1.2.3"');
    expect(prompt?.text).toContain('"sandpiperCodingAgentPackage":"/sandpiper/package"');
    expect(prompt?.text).toContain('"userProfile":""');
    expect(prompt?.text).toContain('"userProfilePath":"/agent/USER.md"');
    expect(prompt?.text).toContain('"versionControl":{"system":"jj","colocatedGit":true,"detection":"session_start"}');
  });

  it('builds from supplied session inputs without detecting VCS or reading even an empty profile again', async () => {
    const dependencies = createDependencies();
    const prompt = await buildSandpiperStartupPrompt(
      {
        agentDir: '/agent',
        cwd: '/repo',
        systemPromptOptions: { cwd: '/repo' },
        versionControl: { system: 'jj', detection: 'session_start' },
        userProfile: '',
      },
      dependencies,
    );

    expect(dependencies.detectVersionControl).not.toHaveBeenCalled();
    expect(dependencies.readUserProfile).not.toHaveBeenCalled();
    expect(prompt?.text).toContain('"versionControl":{"system":"jj","detection":"session_start"}');
    expect(prompt?.text).toContain('"userProfile":""');
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
    expect(prompt?.text).toContain('"userProfile":"# User\\nLikes plans"');
  });

  it('passes the identity file, appended prompt parts, skill tool exposure, and session templates into system prompt construction', async () => {
    const templates = loadSystemPromptTemplates();
    const dependencies = createDependencies();

    await buildSandpiperStartupPrompt(
      {
        cwd: '/repo',
        systemPromptOptions: { cwd: '/repo' },
        identityContent: '<identity>from file</identity>',
        identityPath: '/identity.md',
        appendSystemPromptParts: [{ content: 'appended', path: '/append.md' }],
        skillToolExposure: 'deferred',
        templates,
      },
      dependencies,
    );

    expect(dependencies.buildSystemPrompt).toHaveBeenCalledWith(
      expect.objectContaining({
        identityOverride: '<identity>from file</identity>',
        identityPath: '/identity.md',
        appendSystemPromptParts: [{ content: 'appended', path: '/append.md' }],
        userProfilePath: undefined,
        skillToolExposure: 'deferred',
        templates,
      }),
      { cwd: '/repo' },
    );
  });
});
