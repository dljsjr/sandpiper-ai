import { existsSync } from 'node:fs';
import { appendFile } from 'node:fs/promises';
import { homedir } from 'node:os';
import { dirname, join, normalize } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  joinRendered,
  type PromptTemplate,
  type RenderedText,
  readPromptTemplate,
  renderPromptTemplate,
  sourcedText,
  type TemplateValue,
} from './prompt-template.js';
import type { SandpiperVersionControlContext } from './version-control.js';

const TEMPLATE_NAMES = [
  'system_prompt',
  'identity',
  'interaction_style',
  'role',
  'user_profile',
  'harness_docs',
  'skills',
  'skill_load_instruction_skill_tool',
  'skill_load_instruction_read_tool',
  'injected_context',
  'user_appended_prompt',
  'system_notification_protocol',
] as const;

type SystemPromptTemplateName = (typeof TEMPLATE_NAMES)[number];

export type SystemPromptTemplates = Readonly<Record<SystemPromptTemplateName, PromptTemplate>>;

export interface SandpiperPromptContextFile {
  readonly path: string;
  readonly content: string;
}

export interface SandpiperPromptSkill {
  readonly name: string;
  readonly description: string;
  readonly filePath: string;
  readonly disableModelInvocation?: boolean;
}

export interface SandpiperBaseSystemPromptOptions {
  readonly customPrompt?: string;
  readonly selectedTools?: readonly string[];
  readonly appendSystemPrompt?: string;
  readonly cwd?: string;
  readonly contextFiles?: readonly SandpiperPromptContextFile[];
  readonly skills?: readonly SandpiperPromptSkill[];
}

export interface SandpiperSystemPromptOptions {
  readonly piCodingAgentPackage?: string;
  readonly piCodingAgentVersion?: string;
  readonly sandpiperCodingAgentPackage?: string;
  readonly platform?: NodeJS.Platform | string;
  readonly versionControl?: SandpiperVersionControlContext;
  readonly userProfile?: string;
  /** The file `userProfile` was read from. */
  readonly userProfilePath?: string;
  readonly identityOverride?: string;
  /** The file `identityOverride` was read from. */
  readonly identityPath?: string;
  readonly sessionStartDate?: string;
  readonly dumpSystemPrompt?: boolean;
  /** Defaults to the templates shipped in packages/core/system-prompt/, read on each call. */
  readonly templates?: SystemPromptTemplates;
}

// Source modules and the bundled dist/ chunks both sit inside the product package, which ships
// packages/core/system-prompt/. Walk up to it rather than assume either layout.
function findSystemPromptTemplateDir(): string {
  let dir = dirname(fileURLToPath(import.meta.url));
  while (true) {
    const candidate = join(dir, 'packages', 'core', 'system-prompt');
    if (existsSync(join(candidate, 'system_prompt.md'))) return candidate;
    const parent = dirname(dir);
    if (parent === dir) throw new Error('Sandpiper system prompt templates (packages/core/system-prompt/) not found');
    dir = parent;
  }
}

export function loadSystemPromptTemplates(dir = findSystemPromptTemplateDir()): SystemPromptTemplates {
  return Object.fromEntries(
    TEMPLATE_NAMES.map((name) => [name, readPromptTemplate(join(dir, `${name}.md`))]),
  ) as SystemPromptTemplates;
}

function escapeAttribute(value: string): string {
  return value.replace(/"/g, '&quot;').replace(/'/g, '&apos;');
}

function renderAttributes(attributes: Readonly<Record<string, string>>): string {
  return Object.entries(attributes)
    .map(([name, value]) => ` ${name}="${escapeAttribute(value)}"`)
    .join('');
}

function textElement(tag: string, text: string, indent = ''): string {
  return text === '' ? `${indent}<${tag}/>` : `${indent}<${tag}>${text}</${tag}>`;
}

function element(
  tag: string,
  attributes: Readonly<Record<string, string>>,
  body: TemplateValue,
  indent = '',
): RenderedText {
  const bodyText = typeof body === 'string' ? body : body.text;
  const open = `${indent}<${tag}${renderAttributes(attributes)}`;
  if (bodyText === '') return joinRendered([`${open}/>`]);
  if (!bodyText.includes('<')) return joinRendered([`${open}>`, body, `</${tag}>`]);
  return joinRendered([`${open}>\n`, body, `${indent}</${tag}>`]);
}

export function formatLocalDate(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export function environmentBlock(options: {
  readonly sessionStartDate: string;
  readonly platform: string;
  readonly versionControl?: SandpiperVersionControlContext;
}): string {
  const versionControl = options.versionControl ?? { system: 'unknown' as const, detection: 'session_start' as const };
  const versionControlAttrs: Record<string, string> = {
    system: versionControl.system,
  };
  if (versionControl.colocatedGit !== undefined) {
    versionControlAttrs.colocated_git = String(versionControl.colocatedGit);
  }
  if (versionControl.detection !== undefined) {
    versionControlAttrs.detection = versionControl.detection;
  }

  const children = [
    textElement('session_start_date', options.sessionStartDate, '  '),
    textElement('platform', options.platform, '  '),
    element('version_control', versionControlAttrs, '', '  ').text,
  ]
    .map((child) => `${child}\n`)
    .join('');

  return element('environment', {}, children).text;
}

interface SystemPromptInput {
  readonly options: SandpiperSystemPromptOptions;
  readonly promptOptions: SandpiperBaseSystemPromptOptions;
  readonly templates: SystemPromptTemplates;
}

type TemplateData = Readonly<Record<string, TemplateValue>>;

interface PromptSection {
  readonly template: SystemPromptTemplateName;
  readonly condition: (input: SystemPromptInput) => boolean;
  readonly data: (input: SystemPromptInput) => TemplateData;
}

// The optional sections of the prompt, in order. system_prompt.md places them between the
// identity and the notification protocol; each included section gets a newline before and after.
const SECTIONS: readonly PromptSection[] = [
  { template: 'user_profile', condition: hasUserProfile, data: userProfileData },
  { template: 'harness_docs', condition: hasPackageRoots, data: harnessDocsData },
  { template: 'skills', condition: (input) => visibleSkills(input).length > 0, data: skillsData },
  { template: 'injected_context', condition: hasContextFiles, data: injectedContextData },
  { template: 'user_appended_prompt', condition: hasAppendedPrompt, data: appendedPromptData },
];

const DEFAULT_IDENTITY: readonly SystemPromptTemplateName[] = ['identity', 'interaction_style', 'role'];

function identity({ options, templates }: SystemPromptInput): TemplateValue {
  if (options.identityOverride === undefined) {
    return joinRendered(
      DEFAULT_IDENTITY.map((name) => renderPromptTemplate(templates[name], {})),
      '\n',
    );
  }
  return options.identityPath ? sourcedText(options.identityOverride, options.identityPath) : options.identityOverride;
}

function hasUserProfile({ options }: SystemPromptInput): boolean {
  return (options.userProfile ?? '').trim().length > 0;
}

function userProfileData({ options }: SystemPromptInput): TemplateData {
  const profile = options.userProfile ?? '';
  return { content: options.userProfilePath ? sourcedText(profile, options.userProfilePath) : profile };
}

function hasPackageRoots({ options }: SystemPromptInput): boolean {
  return Boolean(options.piCodingAgentPackage || options.sandpiperCodingAgentPackage);
}

function harnessDocsData({ options }: SystemPromptInput): TemplateData {
  return {
    piRoot: options.piCodingAgentPackage ?? 'PI_CODING_AGENT_PACKAGE',
    sandpiperRoot: options.sandpiperCodingAgentPackage ?? 'SANDPIPER_CODING_AGENT_PACKAGE',
    // A package root that is not set renders as `undefined` here, as it always has.
    piPackage: String(options.piCodingAgentPackage),
    sandpiperPackage: String(options.sandpiperCodingAgentPackage),
    piVersion: options.piCodingAgentVersion ?? '<unknown>',
  };
}

function visibleSkills({ promptOptions }: SystemPromptInput): readonly SandpiperPromptSkill[] {
  return (promptOptions.skills ?? []).filter((skill) => !skill.disableModelInvocation);
}

function skillsData(input: SystemPromptInput): TemplateData {
  const loadInstruction = (input.promptOptions.selectedTools ?? []).includes('skill')
    ? input.templates.skill_load_instruction_skill_tool
    : input.templates.skill_load_instruction_read_tool;
  const skillEntries = visibleSkills(input)
    .map((skill) => element('skill', { name: skill.name, location: skill.filePath }, skill.description, '  ').text)
    .map((entry) => `${entry}\n`)
    .join('');

  return {
    loadInstruction: renderPromptTemplate(loadInstruction, {}),
    availableSkills: element('available_skills', {}, skillEntries).text,
  };
}

function hasContextFiles({ promptOptions }: SystemPromptInput): boolean {
  return (promptOptions.contextFiles ?? []).length > 0;
}

function injectedContextData({ promptOptions }: SystemPromptInput): TemplateData {
  const contextFiles = (promptOptions.contextFiles ?? []).map(({ path, content }) =>
    element('context_file', { path }, sourcedText(content, path)),
  );
  return { contextFiles: joinRendered(contextFiles, '\n\n') };
}

function hasAppendedPrompt({ promptOptions }: SystemPromptInput): boolean {
  return Boolean(promptOptions.appendSystemPrompt);
}

function appendedPromptData({ promptOptions }: SystemPromptInput): TemplateData {
  return { content: promptOptions.appendSystemPrompt ?? '' };
}

async function dumpSystemPromptParts(parts: Readonly<Record<string, TemplateValue>>, prompt: string): Promise<void> {
  const outFilePath = normalize(join(homedir(), `${Date.now()}-SYSPROMPT-DUMP.txt`));
  for (const [key, part] of Object.entries(parts)) {
    const text = typeof part === 'string' ? part : part.text;
    const buffer = `${`
-------- begin ${key} ---------
${text}
--------  end ${key}  ---------`.trim()}\n\n`;
    await appendFile(outFilePath, buffer, { encoding: 'utf8' });
  }

  await appendFile(outFilePath, `\n\n${prompt}`, { encoding: 'utf8' });
}

export async function buildSandpiperSystemPrompt(
  options: SandpiperSystemPromptOptions,
  promptOptions: SandpiperBaseSystemPromptOptions,
): Promise<RenderedText> {
  const input: SystemPromptInput = {
    options,
    promptOptions,
    templates: options.templates ?? loadSystemPromptTemplates(),
  };
  const sections = SECTIONS.filter((section) => section.condition(input)).map(
    (section) =>
      [section.template, renderPromptTemplate(input.templates[section.template], section.data(input))] as const,
  );
  const parts = {
    identity: identity(input),
    sections: joinRendered(sections.map(([, section]) => joinRendered(['\n', section, '\n']))),
    system_notification_protocol: renderPromptTemplate(input.templates.system_notification_protocol, {}),
    environment: environmentBlock({
      sessionStartDate: options.sessionStartDate ?? formatLocalDate(new Date()),
      platform: options.platform ?? process.platform,
      versionControl: options.versionControl,
    }),
  };
  const prompt = renderPromptTemplate(input.templates.system_prompt, parts);

  if (options.dumpSystemPrompt) {
    await dumpSystemPromptParts(
      {
        identity: parts.identity,
        ...Object.fromEntries(sections),
        system_notification_protocol: parts.system_notification_protocol,
        environment: parts.environment,
      },
      prompt.text,
    );
  }

  return prompt;
}
