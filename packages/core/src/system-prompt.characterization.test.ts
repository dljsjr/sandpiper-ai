import { describe, expect, it } from 'vitest';
import {
  buildSandpiperSystemPrompt,
  type SandpiperBaseSystemPromptOptions,
  type SandpiperSystemPromptOptions,
} from './system-prompt.js';

// Each case pins one complete rendered prompt in __snapshots__/system-prompt/<name>.txt. After an
// intended prompt change, review the snapshot diff and update with `bun run test:vitest -- -u`.

interface PromptCase {
  readonly name: string;
  readonly options: SandpiperSystemPromptOptions;
  readonly promptOptions: SandpiperBaseSystemPromptOptions;
}

const PACKAGES = {
  piCodingAgentPackage: '/opt/pi/pkg',
  piCodingAgentVersion: '1.2.3',
  sandpiperCodingAgentPackage: '/opt/sandpiper/pkg',
} as const;

const PROFILE = '# Doug\nPrefers <clear> plans & "direct" answers\n';

const SKILLS = [
  { name: 'jj', description: 'Jujutsu version control', filePath: '/skills/jj/SKILL.md' },
  { name: 'gh', description: 'GitHub CLI, for <issues> & PRs', filePath: '/skills/gh/SKILL.md' },
  { name: 'hid', description: 'hidden', filePath: '/skills/hid/SKILL.md', disableModelInvocation: true },
];

const CONTEXT_FILES = [
  { path: '/repo/AGENTS.md', content: '# Rules\nDo good things\n\nNo <shortcuts> & "no" excuses' },
  { path: '/repo/sub dir/CLAUDE.md', content: 'Second\n' },
];

function base(overrides: Partial<SandpiperBaseSystemPromptOptions> = {}): SandpiperBaseSystemPromptOptions {
  return { cwd: '/repo', selectedTools: ['read', 'bash', 'edit', 'write'], ...overrides };
}

const CASES: readonly PromptCase[] = [
  { name: 'minimal', options: {}, promptOptions: base() },
  {
    name: 'all-sections-skill-tool',
    options: {
      ...PACKAGES,
      userProfile: PROFILE,
      versionControl: { system: 'jj', colocatedGit: true, detection: 'session_start' },
    },
    promptOptions: base({
      selectedTools: ['read', 'skill'],
      appendSystemPrompt: 'Extra <rule> from the user & more\n',
      contextFiles: CONTEXT_FILES,
      skills: SKILLS,
    }),
  },
  {
    name: 'all-sections-read-tool',
    options: { ...PACKAGES, userProfile: PROFILE, versionControl: { system: 'git', detection: 'session_start' } },
    promptOptions: base({ appendSystemPrompt: 'Appended', contextFiles: CONTEXT_FILES, skills: SKILLS }),
  },
  {
    name: 'identity-override',
    options: {
      ...PACKAGES,
      identityOverride: '<identity>custom identity</identity>\n',
      userProfile: PROFILE,
      versionControl: { system: 'none', detection: 'session_start' },
    },
    promptOptions: base({ contextFiles: CONTEXT_FILES }),
  },
  {
    name: 'identity-override-without-trailing-newline',
    options: {
      identityOverride: 'Plain identity text',
      versionControl: { system: 'jj', colocatedGit: false, detection: 'session_start' },
    },
    promptOptions: base(),
  },
  { name: 'pi-package-only', options: { piCodingAgentPackage: '/opt/pi/pkg' }, promptOptions: base() },
  {
    name: 'sandpiper-package-only',
    options: { sandpiperCodingAgentPackage: '/opt/sandpiper/pkg', piCodingAgentVersion: '9.9.9' },
    promptOptions: base(),
  },
  {
    name: 'profile-crlf-and-non-bmp',
    options: { userProfile: '\r\n  Grüße 🙂 <b>&</b>\r\ntrailing   \n\n' },
    promptOptions: base(),
  },
  {
    name: 'context-file-edge-cases',
    options: {},
    promptOptions: base({
      contextFiles: [
        { path: '/repo/AGENTS.md', content: '' },
        { path: '/a b/"c"&<d>\'é.md', content: 'markup <here>\n' },
        { path: '/repo/CLAUDE.md', content: '   \n' },
      ],
    }),
  },
  { name: 'whitespace-only-append', options: {}, promptOptions: base({ appendSystemPrompt: '   \n' }) },
  {
    name: 'hidden-skills-only',
    options: {},
    promptOptions: base({ skills: SKILLS.map((skill) => ({ ...skill, disableModelInvocation: true })) }),
  },
  {
    name: 'version-control-without-detection',
    options: { versionControl: { system: 'unknown' } },
    promptOptions: base(),
  },
];

async function renderPrompt({ options, promptOptions }: PromptCase): Promise<string> {
  const { text } = await buildSandpiperSystemPrompt(
    { platform: 'darwin', sessionStartDate: '2026-09-08', ...options },
    promptOptions,
  );
  return text;
}

describe('rendered system prompt', () => {
  it.each(CASES)('renders $name exactly', async (promptCase) => {
    await expect(await renderPrompt(promptCase)).toMatchFileSnapshot(
      `./__snapshots__/system-prompt/${promptCase.name}.txt`,
    );
  });
});
