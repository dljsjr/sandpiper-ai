import { join } from 'node:path';
import { describe, expect, it, vi } from 'vitest';
import { createSystemRuntimeState } from './session-continuity.js';
import {
  buildSandpiperStartupPrompt,
  readSandpiperStandupContent,
  type StartupPromptDependencies,
} from './startup-prompt.js';

function createDependencies(overrides: Partial<StartupPromptDependencies> = {}): StartupPromptDependencies {
  return {
    buildSystemPrompt: vi.fn(async (options) => JSON.stringify(options)),
    collectActiveTaskContext: vi.fn(() => undefined),
    collectProjectTriggers: vi.fn(() => []),
    collectWorkingCopySummary: vi.fn(() => undefined),
    detectVersionControl: vi.fn(() => ({ system: 'none' as const, detection: 'session_start' as const })),
    env: {
      PI_CODING_AGENT_PACKAGE: '/pi/package',
      PI_CODING_AGENT_VERSION: '1.2.3',
      SANDPIPER_CODING_AGENT_PACKAGE: '/sandpiper/package',
    },
    fileExists: vi.fn(() => false),
    formatActiveTaskContextForPrompt: vi.fn(() => '<active/>'),
    formatColdStartGuidance: vi.fn(() => '<cold-start/>'),
    formatProjectTriggersForPrompt: vi.fn(() => '<projects/>'),
    formatStandupContext: vi.fn((content) => `<standup>${content}</standup>`),
    formatWorkingCopySummaryForPrompt: vi.fn(() => '<working-copy/>'),
    readFile: vi.fn(() => ''),
    readUserProfile: vi.fn(() => ''),
    runStandupRead: vi.fn(() => ''),
    ...overrides,
  };
}

describe('startup prompt operations', () => {
  it('returns undefined for custom prompts without consuming one-shot state', async () => {
    const state = createSystemRuntimeState();
    state.startupContextPending = true;
    state.coldStartGuidancePending = true;

    const prompt = await buildSandpiperStartupPrompt(
      state,
      { cwd: '/repo', systemPromptOptions: { cwd: '/repo', customPrompt: 'custom' } },
      createDependencies(),
    );

    expect(prompt).toBeUndefined();
    expect(state.startupContextPending).toBe(true);
    expect(state.coldStartGuidancePending).toBe(true);
  });

  it('builds prompt context and clears one-shot startup flags', async () => {
    const state = createSystemRuntimeState();
    state.startupContextPending = true;
    state.coldStartGuidancePending = true;
    const dependencies = createDependencies({
      detectVersionControl: vi.fn(() => ({
        system: 'jj' as const,
        colocatedGit: true,
        detection: 'session_start' as const,
      })),
      fileExists: vi.fn(() => true),
      runStandupRead: vi.fn(() => 'standup from cli'),
    });

    const prompt = await buildSandpiperStartupPrompt(
      state,
      { agentDir: '/agent', cwd: '/repo', systemPromptOptions: { cwd: '/repo' } },
      dependencies,
    );

    expect(prompt).toContain('"cwd":"/repo"');
    expect(prompt).toContain('"piCodingAgentPackage":"/pi/package"');
    expect(prompt).toContain('"piCodingAgentVersion":"1.2.3"');
    expect(prompt).toContain('"sandpiperCodingAgentPackage":"/sandpiper/package"');
    expect(prompt).toContain('"userProfile":""');
    expect(prompt).toContain('"projectTriggers":"<projects/>"');
    expect(prompt).toContain('"activeTaskContext":"<active/>"');
    expect(prompt).toContain('"workingCopyContext":"<working-copy/>"');
    expect(prompt).toContain('"coldStartGuidance":"<cold-start/>"');
    expect(prompt).toContain('"standupContent":"<standup>standup from cli</standup>"');
    expect(prompt).toContain('"versionControl":{"system":"jj","colocatedGit":true,"detection":"session_start"}');
    expect(state.startupContextPending).toBe(false);
    expect(state.coldStartGuidancePending).toBe(false);
  });

  it('passes the user profile into system prompt construction', async () => {
    const state = createSystemRuntimeState();
    const dependencies = createDependencies({
      readUserProfile: vi.fn(() => '# User\nLikes plans'),
    });

    const prompt = await buildSandpiperStartupPrompt(
      state,
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

  it('omits one-shot active, working-copy, and cold-start context after startup context is consumed', async () => {
    const state = createSystemRuntimeState();
    state.startupContextPending = false;
    state.coldStartGuidancePending = false;

    const prompt = await buildSandpiperStartupPrompt(
      state,
      { cwd: '/repo', systemPromptOptions: { cwd: '/repo' } },
      createDependencies(),
    );

    expect(prompt).toContain('"projectTriggers":"<projects/>"');
    expect(prompt).toContain('"activeTaskContext":""');
    expect(prompt).toContain('"workingCopyContext":""');
    expect(prompt).toContain('"coldStartGuidance":""');
  });
});

describe('readSandpiperStandupContent', () => {
  it('returns empty content when no standup file exists', () => {
    const content = readSandpiperStandupContent('/repo', {
      fileExists: vi.fn(() => false),
      readFile: vi.fn(() => 'standup file'),
      runStandupRead: vi.fn(() => 'standup cli'),
    });

    expect(content).toBe('');
  });

  it('prefers standup CLI output when available', () => {
    const content = readSandpiperStandupContent('/repo', {
      fileExists: vi.fn(() => true),
      readFile: vi.fn(() => 'standup file'),
      runStandupRead: vi.fn(() => 'standup cli'),
    });

    expect(content).toBe('standup cli');
  });

  it('falls back to direct file content when CLI output is an empty migrated header', () => {
    const readFile = vi.fn(() => 'standup file');

    const content = readSandpiperStandupContent('/repo', {
      fileExists: vi.fn(() => true),
      readFile,
      runStandupRead: vi.fn(() => '# Session Stand-Up'),
    });

    expect(readFile).toHaveBeenCalledWith(join('/repo', '.sandpiper', 'standup.md'));
    expect(content).toBe('standup file');
  });

  it('falls back to direct file content when the CLI read fails', () => {
    const content = readSandpiperStandupContent('/repo', {
      fileExists: vi.fn(() => true),
      readFile: vi.fn(() => 'standup file'),
      runStandupRead: vi.fn(() => {
        throw new Error('missing cli');
      }),
    });

    expect(content).toBe('standup file');
  });
});
