import type { BuildSystemPromptOptions as PiSystemPromptOptions } from '@mariozechner/pi-coding-agent';
import { describe, expect, it, vi } from 'vitest';
import {
  buildSandpiperSystemPrompt,
  formatColdStartGuidance,
  formatStandupContext,
  injectedContextBlock,
  piDocsBlock,
  skillsBlock,
  systemPromptPersonaBlock,
  toolGuidanceBlock,
} from './system-prompt.js';

vi.mock('@toon-format/toon', () => ({
  encode: vi.fn(() => 'mocked-toon'),
}));

function createPiPromptOptions(overrides: Partial<PiSystemPromptOptions> = {}): PiSystemPromptOptions {
  return {
    selectedTools: ['read', 'edit', 'bash'],
    toolSnippets: {
      read: 'Read file contents',
      edit: 'Edit a file',
      bash: 'Run a bash command',
    },
    promptGuidelines: ['Use read for files', 'Show file paths clearly when working with files'],
    contextFiles: [],
    skills: [],
    ...overrides,
  };
}

describe('system-prompt', () => {
  describe('formatStandupContext', () => {
    it('wraps standup content with startup guidance', () => {
      const formatted = formatStandupContext('# Session Stand-Up\n\nHello');
      expect(formatted).toContain('# Previous Session Context');
      expect(formatted).toContain('Do NOT read the session');
      expect(formatted).toContain('Hello');
    });

    it('returns empty string for empty content', () => {
      expect(formatStandupContext('')).toBe('');
    });

    it('returns empty string for whitespace-only content', () => {
      expect(formatStandupContext('   \n\t  ')).toBe('');
    });
  });

  describe('formatColdStartGuidance', () => {
    it('returns cold-start-only guidance text', () => {
      const guidance = formatColdStartGuidance();
      expect(guidance).toContain('# Cold-Start Guidance');
      expect(guidance).toContain('stand-up below');
      expect(guidance).toContain('AGENTS.md routing table');
    });
  });

  describe('piDocsBlock', () => {
    it('includes the pi package directory path', () => {
      const block = piDocsBlock('/opt/pi', '1.0.0');
      expect(block).toContain('/opt/pi/README.md');
      expect(block).toContain('/opt/pi/docs');
    });

    it('includes the pi version', () => {
      const block = piDocsBlock('/opt/pi', '1.0.0');
      expect(block).toContain('Pi version 1.0.0');
    });

    it('uses <unknown> as default version', () => {
      const block = piDocsBlock('/opt/pi');
      expect(block).toContain('Pi version <unknown>');
    });

    it('includes sandpiper-specific config directory differences', () => {
      const block = piDocsBlock('/opt/pi', '1.0.0');
      expect(block).toContain("'~/.sandpiper' instead of '~/.pi'");
      expect(block).toContain("'./.sandpiper' instead of './.pi'");
    });
  });

  describe('systemPromptPersonaBlock', () => {
    it('wraps identity in BEGIN/END PERSONA markers', () => {
      const block = systemPromptPersonaBlock({});
      expect(block).toContain('[BEGIN PERSONA]');
      expect(block).toContain('[END PERSONA]');
    });

    it('includes the identity block content', () => {
      const block = systemPromptPersonaBlock({});
      expect(block).toContain('Sandpiper');
      expect(block).toContain('Operational Principles');
      expect(block).toContain('Coding Guidelines');
    });

    it('includes pi docs block when piCodingAgentPackage is provided', () => {
      const block = systemPromptPersonaBlock({ piCodingAgentPackage: '/opt/pi', piCodingAgentVersion: '1.0.0' });
      expect(block).toContain('Extending The Harness');
      expect(block).toContain('/opt/pi/README.md');
    });

    it('omits pi docs block when piCodingAgentPackage is not provided', () => {
      const block = systemPromptPersonaBlock({});
      expect(block).not.toContain('Extending The Harness');
    });
  });

  describe('toolGuidanceBlock', () => {
    it('renders tool snippets for selected tools', () => {
      const options = createPiPromptOptions({
        selectedTools: ['read', 'edit'],
        toolSnippets: {
          read: 'Read file contents',
          edit: 'Edit a file',
        },
      });

      const block = toolGuidanceBlock(options);
      expect(block).toContain('[BEGIN TOOL INFO]');
      expect(block).toContain('[END TOOL INFO]');
      expect(block).toContain('## Available Tools');
      expect(block).toContain('- read: Read file contents');
      expect(block).toContain('- edit: Edit a file');
    });

    it('omits tool snippets for tools not in selectedTools', () => {
      const options = createPiPromptOptions({
        selectedTools: ['read'],
        toolSnippets: {
          read: 'Read file contents',
          edit: 'Edit a file',
        },
      });

      const block = toolGuidanceBlock(options);
      expect(block).toContain('- read: Read file contents');
      expect(block).not.toContain('- edit: Edit a file');
    });

    it('renders guidelines and strips "Be concise"', () => {
      const options = createPiPromptOptions({
        promptGuidelines: ['Be concise in your responses', 'Show file paths clearly when working with files'],
      });

      const block = toolGuidanceBlock(options);
      expect(block).toContain('## Guidelines:');
      expect(block).toContain('- Show file paths clearly');
      expect(block).not.toContain('Be concise in your responses');
    });

    it('omits empty tool snippets', () => {
      const options = createPiPromptOptions({
        selectedTools: ['read', 'edit'],
        toolSnippets: {
          read: 'Read file contents',
          edit: '',
        },
      });

      const block = toolGuidanceBlock(options);
      expect(block).toContain('- read: Read file contents');
      expect(block).not.toContain('- edit:');
    });
  });

  describe('injectedContextBlock', () => {
    it('returns undefined when no context files are present', () => {
      const options = createPiPromptOptions({ contextFiles: [] });
      expect(injectedContextBlock(options)).toBeUndefined();
    });

    it('renders context files with BEGIN/END markers', () => {
      const options = createPiPromptOptions({
        contextFiles: [{ path: 'AGENTS.md', content: '# Rules\nDo good things' }],
      });

      const block = injectedContextBlock(options)!;
      expect(block).toContain('[BEGIN INJECTED CONTEXT]');
      expect(block).toContain('[END INJECTED CONTEXT]');
      expect(block).toContain('=== [BEGIN AGENTS.md]');
      expect(block).toContain('=== [END AGENTS.md]');
      expect(block).toContain('Do good things');
    });

    it('renders multiple context files', () => {
      const options = createPiPromptOptions({
        contextFiles: [
          { path: 'AGENTS.md', content: 'First' },
          { path: 'CLAUDE.md', content: 'Second' },
        ],
      });

      const block = injectedContextBlock(options)!;
      expect(block).toContain('=== [BEGIN AGENTS.md]');
      expect(block).toContain('=== [BEGIN CLAUDE.md]');
    });
  });

  describe('skillsBlock', () => {
    it('returns undefined when no skills are present', () => {
      const options = createPiPromptOptions({ skills: [] });
      expect(skillsBlock(options)).toBeUndefined();
    });

    it('renders skills catalogue with toon encoding', () => {
      const options = createPiPromptOptions({
        skills: [
          {
            name: 'jj',
            description: 'Jujutsu version control',
            filePath: '/skills/jj/SKILL.md',
            baseDir: '/skills/jj',
            sourceInfo: { path: '/skills/jj/SKILL.md', source: 'local', scope: 'user', origin: 'top-level' },
            disableModelInvocation: false,
          },
        ],
      });

      const block = skillsBlock(options)!;
      expect(block).toContain('[BEGIN SKILLS]');
      expect(block).toContain('[END SKILLS]');
      expect(block).toContain('mocked-toon');
    });
  });

  describe('buildSandpiperSystemPrompt', () => {
    it('produces a prompt with all required sections', async () => {
      const promptOptions = createPiPromptOptions();
      const prompt = await buildSandpiperSystemPrompt({ cwd: '/repo' }, promptOptions);

      expect(prompt).toContain('[BEGIN PERSONA]');
      expect(prompt).toContain('[BEGIN TOOL INFO]');
      expect(prompt).toContain('Current Date:');
      expect(prompt).toContain('Current working directory: /repo');
    });

    it('formats cwd with forward slashes', async () => {
      const promptOptions = createPiPromptOptions();
      const prompt = await buildSandpiperSystemPrompt({ cwd: 'C:\\Users\\test\\repo' }, promptOptions);
      expect(prompt).toContain('Current working directory: C:/Users/test/repo');
    });

    it('defaults cwd to process.cwd()', async () => {
      const promptOptions = createPiPromptOptions();
      const prompt = await buildSandpiperSystemPrompt({}, promptOptions);
      expect(prompt).toContain('Current working directory:');
    });

    it('includes injected context when context files are present', async () => {
      const promptOptions = createPiPromptOptions({
        contextFiles: [{ path: 'AGENTS.md', content: '# Rules\nDo good things' }],
      });

      const prompt = await buildSandpiperSystemPrompt({ cwd: '/repo' }, promptOptions);
      expect(prompt).toContain('[BEGIN INJECTED CONTEXT]');
      expect(prompt).toContain('AGENTS.md');
      expect(prompt).toContain('Do good things');
    });

    it('omits injected context when no context files are present', async () => {
      const promptOptions = createPiPromptOptions({ contextFiles: [] });
      const prompt = await buildSandpiperSystemPrompt({ cwd: '/repo' }, promptOptions);
      expect(prompt).not.toContain('[BEGIN INJECTED CONTEXT]');
    });

    it('includes skills block when skills are present', async () => {
      const promptOptions = createPiPromptOptions({
        skills: [
          {
            name: 'jj',
            description: 'Jujutsu',
            filePath: '/skills/jj/SKILL.md',
            baseDir: '/skills/jj',
            sourceInfo: { path: '/skills/jj/SKILL.md', source: 'local', scope: 'user', origin: 'top-level' },
            disableModelInvocation: false,
          },
        ],
      });

      const prompt = await buildSandpiperSystemPrompt({ cwd: '/repo' }, promptOptions);
      expect(prompt).toContain('[BEGIN SKILLS]');
    });

    it('omits skills block when no skills are present', async () => {
      const promptOptions = createPiPromptOptions({ skills: [] });
      const prompt = await buildSandpiperSystemPrompt({ cwd: '/repo' }, promptOptions);
      expect(prompt).not.toContain('[BEGIN SKILLS]');
    });

    it('includes pi docs block when piCodingAgentPackage is set', async () => {
      const promptOptions = createPiPromptOptions();
      const prompt = await buildSandpiperSystemPrompt(
        { cwd: '/repo', piCodingAgentPackage: '/opt/pi', piCodingAgentVersion: '1.0.0' },
        promptOptions,
      );
      expect(prompt).toContain('Extending The Harness');
      expect(prompt).toContain('/opt/pi/README.md');
    });

    it('omits pi docs block when piCodingAgentPackage is not set', async () => {
      const promptOptions = createPiPromptOptions();
      const prompt = await buildSandpiperSystemPrompt({ cwd: '/repo' }, promptOptions);
      expect(prompt).not.toContain('Extending The Harness');
    });

    it('includes user appended prompt content when appendSystemPrompt is set', async () => {
      const promptOptions = createPiPromptOptions({
        appendSystemPrompt: 'Extra instructions from the user',
      });

      const prompt = await buildSandpiperSystemPrompt({ cwd: '/repo' }, promptOptions);
      expect(prompt).toContain('[BEGIN USER APPENDED PROMPT CONTENT]');
      expect(prompt).toContain('Extra instructions from the user');
      expect(prompt).toContain('[END USER APPENDED PROMPT CONTENT]');
    });

    it('omits user appended prompt block when appendSystemPrompt is not set', async () => {
      const promptOptions = createPiPromptOptions();
      const prompt = await buildSandpiperSystemPrompt({ cwd: '/repo' }, promptOptions);
      expect(prompt).not.toContain('[BEGIN USER APPENDED PROMPT CONTENT]');
    });
  });
});
