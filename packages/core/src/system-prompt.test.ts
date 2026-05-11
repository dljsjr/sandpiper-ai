import { describe, expect, it } from 'vitest';
import {
  buildSandpiperSystemPrompt,
  formatColdStartGuidance,
  formatStandupContext,
  injectedContextBlock,
  piDocsBlock,
  type SandpiperBaseSystemPromptOptions,
  skillsBlock,
  systemPromptPersonaBlock,
  toolGuidanceBlock,
  userProfileBlock,
} from './system-prompt.js';

function createPromptOptions(
  overrides: Partial<SandpiperBaseSystemPromptOptions> = {},
): SandpiperBaseSystemPromptOptions {
  return {
    selectedTools: ['read', 'edit', 'bash'],
    toolSnippets: {
      read: 'Read file contents',
      edit: 'Edit a file',
      bash: 'Run a bash command',
    },
    promptGuidelines: ['Use read for files', 'Show file paths clearly when working with files'],
    cwd: '/tmp/sandpiper-test',
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
      expect(block).toContain('<harness_docs>');
      expect(block).toContain('Pi: `/opt/pi`');
      expect(block).toContain('`README.md`, `docs/`, `examples/`');
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
    it('wraps identity in persona XML tags', () => {
      const block = systemPromptPersonaBlock({});
      expect(block).toContain('<persona>');
      expect(block).toContain('</persona>');
      expect(block).toContain('<identity>');
      expect(block).toContain('</identity>');
    });

    it('includes the identity block content', () => {
      const block = systemPromptPersonaBlock({});
      expect(block).toContain('You are Sandpiper');
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
      expect(block).toContain('<content># User\nPrefers &lt;clear&gt; &amp; direct communication</content>');
    });
  });

  describe('toolGuidanceBlock', () => {
    it('renders tool snippets for selected tools', () => {
      const options = createPromptOptions({
        selectedTools: ['read', 'edit'],
        toolSnippets: {
          read: 'Read file contents',
          edit: 'Edit a file',
        },
      });

      const block = toolGuidanceBlock(options);
      expect(block).toContain('<tools>');
      expect(block).toContain('</tools>');
      expect(block).toContain('<available_tools>');
      expect(block).toContain('<tool name="read">Read file contents</tool>');
      expect(block).toContain('<tool name="edit">Edit a file</tool>');
    });

    it('omits tool snippets for tools not in selectedTools', () => {
      const options = createPromptOptions({
        selectedTools: ['read'],
        toolSnippets: {
          read: 'Read file contents',
          edit: 'Edit a file',
        },
      });

      const block = toolGuidanceBlock(options);
      expect(block).toContain('<tool name="read">Read file contents</tool>');
      expect(block).not.toContain('<tool name="edit">Edit a file</tool>');
    });

    it('renders guidelines and strips "Be concise"', () => {
      const options = createPromptOptions({
        promptGuidelines: ['Be concise in your responses', 'Show file paths clearly when working with files'],
      });

      const block = toolGuidanceBlock(options);
      expect(block).toContain('Guidelines:');
      expect(block).toContain('- Show file paths clearly');
      expect(block).not.toContain('Be concise in your responses');
    });

    it('omits empty tool snippets', () => {
      const options = createPromptOptions({
        selectedTools: ['read', 'edit'],
        toolSnippets: {
          read: 'Read file contents',
          edit: '',
        },
      });

      const block = toolGuidanceBlock(options);
      expect(block).toContain('<tool name="read">Read file contents</tool>');
      expect(block).not.toContain('<tool name="edit"');
    });

    it('escapes XML in tool entries', () => {
      const options = createPromptOptions({
        selectedTools: ['read<&'],
        toolSnippets: {
          'read<&': 'Read <files> & report "paths"',
        },
      });

      const block = toolGuidanceBlock(options);
      expect(block).toContain('<tool name="read&lt;&amp;">Read &lt;files&gt; &amp; report &quot;paths&quot;</tool>');
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
      expect(block).toContain('Skill loading rules:');
      expect(block).toContain('The catalogue below is routing metadata only; it is not the skill instructions.');
      expect(block).toContain("compare the user's request, acquired context, and intended next actions");
      expect(block).toContain('read its `SKILL.md` with the `read` tool from the exact `location`');
      expect(block).toContain('If multiple skills match, load all relevant skills.');
      expect(block).toContain(
        'If later context reveals a new skill match, stop and load that skill before continuing.',
      );
      expect(block).toContain(
        'Resolve skill-referenced scripts and files relative to the directory containing `SKILL.md`.',
      );
    });
  });

  describe('buildSandpiperSystemPrompt', () => {
    it('produces a prompt with all required sections', async () => {
      const promptOptions = createPromptOptions();
      const prompt = await buildSandpiperSystemPrompt({ cwd: '/repo', platform: 'darwin' }, promptOptions);

      expect(prompt).toContain('<persona>');
      expect(prompt).toContain('<tools>');
      expect(prompt).toContain('<environment>');
      expect(prompt).toContain('<current_date>');
      expect(prompt).toContain('<cwd>/repo</cwd>');
    });

    it('formats cwd with forward slashes', async () => {
      const promptOptions = createPromptOptions();
      const prompt = await buildSandpiperSystemPrompt({ cwd: 'C:\\Users\\test\\repo' }, promptOptions);
      expect(prompt).toContain('<cwd>C:/Users/test/repo</cwd>');
    });

    it('defaults cwd to process.cwd()', async () => {
      const promptOptions = createPromptOptions();
      const prompt = await buildSandpiperSystemPrompt({}, promptOptions);
      expect(prompt).toContain('<cwd>');
    });

    it('includes user profile when provided', async () => {
      const promptOptions = createPromptOptions();
      const prompt = await buildSandpiperSystemPrompt(
        { cwd: '/repo', userProfile: '# Doug\nLikes clear plans' },
        promptOptions,
      );

      expect(prompt).toContain('<user_profile>');
      expect(prompt).toContain('Likes clear plans');
    });

    it('omits user profile when not provided', async () => {
      const promptOptions = createPromptOptions();
      const prompt = await buildSandpiperSystemPrompt({ cwd: '/repo' }, promptOptions);
      expect(prompt).not.toContain('<user_profile>');
    });

    it('includes injected context when context files are present', async () => {
      const promptOptions = createPromptOptions({
        contextFiles: [{ path: 'AGENTS.md', content: '# Rules\nDo good things' }],
      });

      const prompt = await buildSandpiperSystemPrompt({ cwd: '/repo' }, promptOptions);
      expect(prompt).toContain('<injected_context>');
      expect(prompt).toContain('AGENTS.md');
      expect(prompt).toContain('Do good things');
    });

    it('omits injected context when no context files are present', async () => {
      const promptOptions = createPromptOptions({ contextFiles: [] });
      const prompt = await buildSandpiperSystemPrompt({ cwd: '/repo' }, promptOptions);
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

      const prompt = await buildSandpiperSystemPrompt({ cwd: '/repo' }, promptOptions);
      expect(prompt).toContain('<skills>');
    });

    it('omits skills block when no skills are present', async () => {
      const promptOptions = createPromptOptions({ skills: [] });
      const prompt = await buildSandpiperSystemPrompt({ cwd: '/repo' }, promptOptions);
      expect(prompt).not.toContain('<skills>');
    });

    it('includes harness docs block when package roots are set', async () => {
      const promptOptions = createPromptOptions();
      const prompt = await buildSandpiperSystemPrompt(
        {
          cwd: '/repo',
          piCodingAgentPackage: '/opt/pi',
          piCodingAgentVersion: '1.0.0',
          sandpiperCodingAgentPackage: '/opt/sandpiper',
        },
        promptOptions,
      );
      expect(prompt).toContain('<harness_docs>');
      expect(prompt).toContain('Pi: `/opt/pi`');
      expect(prompt).toContain('Sandpiper: `/opt/sandpiper`');
    });

    it('omits harness docs block when package roots are not set', async () => {
      const promptOptions = createPromptOptions();
      const prompt = await buildSandpiperSystemPrompt({ cwd: '/repo' }, promptOptions);
      expect(prompt).not.toContain('<harness_docs>');
    });

    it('includes user appended prompt content when appendSystemPrompt is set', async () => {
      const promptOptions = createPromptOptions({
        appendSystemPrompt: 'Extra instructions from the user',
      });

      const prompt = await buildSandpiperSystemPrompt({ cwd: '/repo' }, promptOptions);
      expect(prompt).toContain('<user_appended_prompt>');
      expect(prompt).toContain('Extra instructions from the user');
      expect(prompt).toContain('</user_appended_prompt>');
    });

    it('omits user appended prompt block when appendSystemPrompt is not set', async () => {
      const promptOptions = createPromptOptions();
      const prompt = await buildSandpiperSystemPrompt({ cwd: '/repo' }, promptOptions);
      expect(prompt).not.toContain('<user_appended_prompt>');
    });
  });
});
