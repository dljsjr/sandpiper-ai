import { describe, expect, it } from 'vitest';
import {
  buildSandpiperSystemPrompt,
  injectedContextBlock,
  piDocsBlock,
  type SandpiperBaseSystemPromptOptions,
  skillsBlock,
  systemNotificationProtocolBlock,
  systemPromptPersonaBlock,
  userProfileBlock,
} from './system-prompt.js';

function createPromptOptions(
  overrides: Partial<SandpiperBaseSystemPromptOptions> = {},
): SandpiperBaseSystemPromptOptions {
  return {
    selectedTools: ['read', 'edit', 'bash'],
    cwd: '/tmp/sandpiper-test',
    contextFiles: [],
    skills: [],
    ...overrides,
  };
}

describe('system-prompt', () => {
  describe('piDocsBlock', () => {
    it('includes the pi package directory path', () => {
      const block = piDocsBlock('/opt/pi', '1.0.0');
      expect(block).toContain('<harness_docs>');
      expect(block).toContain('Pi: `/opt/pi`');
      expect(block).toContain('Main docs: `README.md`');
      expect(block).toContain('Additional docs: `docs/`');
      expect(block).toContain('Examples: `examples/`');
    });

    it('includes the Sandpiper package directory path when provided', () => {
      const block = piDocsBlock('/opt/pi', '1.0.0', '/opt/sandpiper');
      expect(block).toContain('Sandpiper: `/opt/sandpiper`');
    });

    it('includes the pi version', () => {
      const block = piDocsBlock('/opt/pi', '1.0.0');
      expect(block).toContain('Pi version: `1.0.0`');
    });

    it('uses <unknown> as default version', () => {
      const block = piDocsBlock('/opt/pi');
      expect(block).toContain('Pi version: `<unknown>`');
    });

    it('includes sandpiper-specific config directory differences', () => {
      const block = piDocsBlock('/opt/pi', '1.0.0');
      expect(block).toContain('global config: `~/.sandpiper`, not `~/.pi`');
      expect(block).toContain('project config: `.sandpiper`, not `.pi`');
    });
  });

  describe('systemPromptPersonaBlock', () => {
    it('renders identity and operating guidance fragments', () => {
      const block = systemPromptPersonaBlock({});
      expect(block).toContain('<identity>');
      expect(block).toContain('</identity>');
      expect(block).toContain('<interaction_style>');
      expect(block).toContain('<role>');
    });

    it('includes the identity block content', () => {
      const block = systemPromptPersonaBlock({});
      expect(block).toContain('expert coding agent');
      expect(block).toContain('sandpiper coding agent harness');
      expect(block).toContain('Operating Principles');
      expect(block).toContain('Coding Defaults');
    });

    it('does not include harness docs', () => {
      const block = systemPromptPersonaBlock({ piCodingAgentPackage: '/opt/pi', piCodingAgentVersion: '1.0.0' });
      expect(block).not.toContain('<harness_docs>');
    });
  });

  describe('userProfileBlock', () => {
    it('returns undefined when no user profile content is present', () => {
      expect(userProfileBlock('')).toBeUndefined();
      expect(userProfileBlock('  \n')).toBeUndefined();
    });

    it('renders user profile content as XML', () => {
      const block = userProfileBlock('# User\nPrefers <clear> & direct communication')!;

      expect(block).toContain('<user_profile>');
      expect(block).toContain('</user_profile>');
      expect(block).toContain('working preferences');
      expect(block).toContain('<content># User\nPrefers <clear> & direct communication</content>');
    });
  });

  describe('injectedContextBlock', () => {
    it('returns undefined when no context files are present', () => {
      const options = createPromptOptions({ contextFiles: [] });
      expect(injectedContextBlock(options)).toBeUndefined();
    });

    it('renders context files with XML tags', () => {
      const options = createPromptOptions({
        contextFiles: [{ path: 'AGENTS.md', content: '# Rules\nDo good things' }],
      });

      const block = injectedContextBlock(options)!;
      expect(block).toContain('<injected_context>');
      expect(block).toContain('</injected_context>');
      expect(block).toContain('<context_file path="AGENTS.md">');
      expect(block).toContain('</context_file>');
      expect(block).toContain('Do good things');
    });

    it('renders multiple context files', () => {
      const options = createPromptOptions({
        contextFiles: [
          { path: 'AGENTS.md', content: 'First' },
          { path: 'CLAUDE.md', content: 'Second' },
        ],
      });

      const block = injectedContextBlock(options)!;
      expect(block).toContain('<context_file path="AGENTS.md">');
      expect(block).toContain('<context_file path="CLAUDE.md">');
    });
  });

  describe('skillsBlock', () => {
    it('returns undefined when no skills are present', () => {
      const options = createPromptOptions({ skills: [] });
      expect(skillsBlock(options)).toBeUndefined();
    });

    it('renders skills catalogue as XML', () => {
      const options = createPromptOptions({
        skills: [
          {
            name: 'jj',
            description: 'Jujutsu version control',
            filePath: '/skills/jj/SKILL.md',
          },
        ],
      });

      const block = skillsBlock(options)!;
      expect(block).toContain('<skills>');
      expect(block).toContain('</skills>');
      expect(block).toContain('<available_skills>');
      expect(block).toContain('<skill name="jj" location="/skills/jj/SKILL.md">');
      expect(block).toContain('Jujutsu version control');
    });

    it('renders focused skill loading rules', () => {
      const options = createPromptOptions({
        skills: [
          {
            name: 'jj',
            description: 'Jujutsu version control',
            filePath: '/skills/jj/SKILL.md',
          },
        ],
      });

      const block = skillsBlock(options)!;
      expect(block).toContain('The following skills provide specialized instructions');
      expect(block).toContain("Use the `read` tool to load the skill's SKILL.md file from the exact `location`");
      expect(block).toContain('If multiple skills match, load all relevant skills.');
      expect(block).toContain("resolve it against the skill's base directory or location, and use the absolute path.");
    });

    it('uses skill for skill loading rules when the tool is active', () => {
      const options = createPromptOptions({
        selectedTools: ['read', 'skill'],
        skills: [
          {
            name: 'jj',
            description: 'Jujutsu version control',
            filePath: '/skills/jj/SKILL.md',
          },
        ],
      });

      const block = skillsBlock(options)!;
      expect(block).toContain('Use the `skill` tool to load relevant skills by name');
      expect(block).toContain('If multiple skills match, load all relevant skills.');
      expect(block).toContain("resolve it against the skill's base directory or location, and use the absolute path.");
      expect(block).not.toContain("Use the `read` tool to load the skill's SKILL.md");
    });
  });

  describe('systemNotificationProtocolBlock', () => {
    it('defines system notification XML authorship semantics', () => {
      const block = systemNotificationProtocolBlock();

      expect(block).toContain('<system_notification_protocol>');
      expect(block).toContain('<sandpiper_system_notification>');
      expect(block).toContain('These are not user messages');
      expect(block).toContain('This guidance is scoped to the handling of that notification only');
    });
  });

  describe('buildSandpiperSystemPrompt', () => {
    it('produces a prompt with all required sections', async () => {
      const promptOptions = createPromptOptions();
      const prompt = await buildSandpiperSystemPrompt(
        { platform: 'darwin', sessionStartDate: '2026-09-08' },
        promptOptions,
      );

      expect(prompt).toContain('<identity>');
      expect(prompt).not.toContain('<tools>');
      expect(prompt).toContain('<system_notification_protocol>');
      expect(prompt).toContain('<environment>');
      expect(prompt).toContain('<session_start_date>2026-09-08</session_start_date>');
      expect(prompt).not.toContain('<current_date>');
    });

    it("leaves the working directory to Pi's cwd section", async () => {
      const promptOptions = createPromptOptions();
      const prompt = await buildSandpiperSystemPrompt({ platform: 'darwin' }, promptOptions);
      expect(prompt).not.toContain('<cwd>');
    });

    it('includes user profile when provided', async () => {
      const promptOptions = createPromptOptions();
      const prompt = await buildSandpiperSystemPrompt({ userProfile: '# Doug\nLikes clear plans' }, promptOptions);

      expect(prompt).toContain('<user_profile>');
      expect(prompt).toContain('Likes clear plans');
    });

    it('omits user profile when not provided', async () => {
      const promptOptions = createPromptOptions();
      const prompt = await buildSandpiperSystemPrompt({}, promptOptions);
      expect(prompt).not.toContain('<user_profile>');
    });

    it('includes injected context when context files are present', async () => {
      const promptOptions = createPromptOptions({
        contextFiles: [{ path: 'AGENTS.md', content: '# Rules\nDo good things' }],
      });

      const prompt = await buildSandpiperSystemPrompt({}, promptOptions);
      expect(prompt).toContain('<injected_context>');
      expect(prompt).toContain('AGENTS.md');
      expect(prompt).toContain('Do good things');
    });

    it('omits injected context when no context files are present', async () => {
      const promptOptions = createPromptOptions({ contextFiles: [] });
      const prompt = await buildSandpiperSystemPrompt({}, promptOptions);
      expect(prompt).not.toContain('<injected_context>');
    });

    it('includes skills block when skills are present', async () => {
      const promptOptions = createPromptOptions({
        skills: [
          {
            name: 'jj',
            description: 'Jujutsu',
            filePath: '/skills/jj/SKILL.md',
          },
        ],
      });

      const prompt = await buildSandpiperSystemPrompt({}, promptOptions);
      expect(prompt).toContain('<skills>');
    });

    it('omits skills block when no skills are present', async () => {
      const promptOptions = createPromptOptions({ skills: [] });
      const prompt = await buildSandpiperSystemPrompt({}, promptOptions);
      expect(prompt).not.toContain('<skills>');
    });

    it('includes harness docs block when package roots are set', async () => {
      const promptOptions = createPromptOptions();
      const prompt = await buildSandpiperSystemPrompt(
        {
          piCodingAgentPackage: '/opt/pi',
          piCodingAgentVersion: '1.0.0',
          sandpiperCodingAgentPackage: '/opt/sandpiper',
        },
        promptOptions,
      );
      expect(prompt).toContain('<harness_docs>');
      expect(prompt).toContain('Pi: `/opt/pi`');
      expect(prompt).toContain('Sandpiper: `/opt/sandpiper`');
      expect(prompt).toContain('MCP servers (docs/mcp.md)');
      expect(prompt).toContain(
        'codemode scripts and non-LLM models such as classifiers and image models (docs/codemode.md)',
      );
    });

    it('omits harness docs block when package roots are not set', async () => {
      const promptOptions = createPromptOptions();
      const prompt = await buildSandpiperSystemPrompt({}, promptOptions);
      expect(prompt).not.toContain('<harness_docs>');
    });

    it('includes user appended prompt content when appendSystemPrompt is set', async () => {
      const promptOptions = createPromptOptions({
        appendSystemPrompt: 'Extra instructions from the user',
      });

      const prompt = await buildSandpiperSystemPrompt({}, promptOptions);
      expect(prompt).toContain('<user_appended_prompt>');
      expect(prompt).toContain('Extra instructions from the user');
      expect(prompt).toContain('</user_appended_prompt>');
    });

    it('omits user appended prompt block when appendSystemPrompt is not set', async () => {
      const promptOptions = createPromptOptions();
      const prompt = await buildSandpiperSystemPrompt({}, promptOptions);
      expect(prompt).not.toContain('<user_appended_prompt>');
    });
  });
});
