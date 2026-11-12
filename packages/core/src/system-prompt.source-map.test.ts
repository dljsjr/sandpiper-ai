import { cpSync, mkdtempSync, readFileSync, realpathSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { type EditableSpan, verifyEditableSpans } from './prompt-template.js';
import {
  buildSandpiperSystemPrompt,
  environmentBlock,
  loadSystemPromptTemplates,
  type SandpiperBaseSystemPromptOptions,
  type SandpiperSystemPromptOptions,
} from './system-prompt.js';

function uncovered(text: string, spans: readonly EditableSpan[]): string[] {
  const segments: string[] = [];
  let offset = 0;
  for (const span of spans) {
    expect(span.start).toBeGreaterThanOrEqual(offset);
    if (span.start > offset) segments.push(text.slice(offset, span.start));
    offset = span.end;
  }
  if (offset < text.length) segments.push(text.slice(offset));
  return segments;
}

const RENDER_DEFAULTS = { platform: 'darwin', sessionStartDate: '2026-09-08' } as const;

describe('system prompt source map', () => {
  let root: string;

  beforeEach(() => {
    root = realpathSync(mkdtempSync(join(tmpdir(), 'sandpiper-prompt-source-map-')));
  });

  afterEach(() => {
    rmSync(root, { recursive: true, force: true });
  });

  it('maps all text to a template or user file except the computed values', async () => {
    const userProfilePath = join(root, 'USER.md');
    const agentsPath = join(root, 'AGENTS.md');
    const userProfile = '# Doug\r\nPrefers <clear> plans\n';
    const agents = 'Use <jj> & keep it tidy.\n';
    writeFileSync(userProfilePath, userProfile);
    writeFileSync(agentsPath, agents);
    const options: SandpiperSystemPromptOptions = {
      ...RENDER_DEFAULTS,
      piCodingAgentPackage: '/opt/pi',
      piCodingAgentVersion: '1.2.3',
      sandpiperCodingAgentPackage: '/opt/sp',
      userProfile,
      userProfilePath,
      versionControl: { system: 'git', detection: 'session_start' },
    };
    const promptOptions: SandpiperBaseSystemPromptOptions = {
      selectedTools: ['skill'],
      appendSystemPrompt: 'Appended',
      contextFiles: [{ path: agentsPath, content: agents }],
      skills: [{ name: 'jj', description: 'Jujutsu', filePath: '/skills/jj/SKILL.md' }],
    };

    const { text, spans } = await buildSandpiperSystemPrompt(options, promptOptions);

    expect(verifyEditableSpans(text, spans)).toEqual(spans);
    expect(uncovered(text, spans)).toEqual([
      '\n',
      '\n',
      '\n',
      '\n\n',
      '/opt/pi',
      '/opt/sp',
      '/opt/pi',
      '/opt/sp',
      '1.2.3',
      '\n\n',
      '<available_skills>\n  <skill name="jj" location="/skills/jj/SKILL.md">Jujutsu</skill>\n</available_skills>',
      '\n\n',
      `<context_file path="${agentsPath}">\n`,
      '</context_file>',
      '\n\n',
      'Appended',
      '\n',
      environmentBlock({
        sessionStartDate: '2026-09-08',
        platform: 'darwin',
        versionControl: { system: 'git', detection: 'session_start' },
      }),
    ]);
    const templateDir = dirname(loadSystemPromptTemplates().system_prompt.path);
    expect(new Set(spans.map((span) => span.path))).toEqual(
      new Set([
        ...[
          'system_prompt',
          'identity',
          'interaction_style',
          'role',
          'user_profile',
          'harness_docs',
          'skills',
          'skill_load_instruction_skill_tool',
          'injected_context',
          'user_appended_prompt',
          'system_notification_protocol',
        ].map((name) => join(templateDir, `${name}.md`)),
        userProfilePath,
        agentsPath,
      ]),
    );
  });

  it('maps an identity override to the file it was read from', async () => {
    const identityPath = join(root, 'identity.md');
    const identity = '<identity>from file</identity>\n';
    writeFileSync(identityPath, identity);

    const fromFile = await buildSandpiperSystemPrompt({ identityOverride: identity, identityPath }, {});
    const raw = await buildSandpiperSystemPrompt({ identityOverride: identity }, {});

    expect(verifyEditableSpans(fromFile.text, fromFile.spans)).toContainEqual({
      start: '<system_prompt>'.length,
      end: '<system_prompt>'.length + identity.length,
      path: identityPath,
      sourceStart: 0,
      sourceEnd: identity.length,
      codec: 'direct',
    });
    expect(raw.text).toBe(fromFile.text);
    expect(raw.spans.some((span) => span.path === identityPath)).toBe(false);
  });

  it('renders templates read from the given directory', async () => {
    const templateDir = join(root, 'templates');
    cpSync(dirname(loadSystemPromptTemplates().system_prompt.path), templateDir, { recursive: true });
    const identityPath = join(templateDir, 'identity.md');
    writeFileSync(identityPath, readFileSync(identityPath, 'utf-8').replace('friendly, expert', 'edited'));

    const { text, spans } = await buildSandpiperSystemPrompt(
      { ...RENDER_DEFAULTS, templates: loadSystemPromptTemplates(templateDir) },
      {},
    );

    expect(text).toContain('You are a edited coding agent');
    expect(verifyEditableSpans(text, spans).filter((span) => span.path === identityPath)).toHaveLength(1);
  });

  it('fails loudly on a placeholder no section provides', async () => {
    const templateDir = join(root, 'templates');
    cpSync(dirname(loadSystemPromptTemplates().system_prompt.path), templateDir, { recursive: true });
    writeFileSync(join(templateDir, 'harness_docs.md'), 'Pi version: {{piVersoin}}\n');

    await expect(
      buildSandpiperSystemPrompt(
        { ...RENDER_DEFAULTS, piCodingAgentPackage: '/opt/pi', templates: loadSystemPromptTemplates(templateDir) },
        {},
      ),
    ).rejects.toThrow('harness_docs.md: unknown placeholder {{piVersoin}}');
  });
});
