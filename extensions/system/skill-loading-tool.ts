import { readFile } from 'node:fs/promises';
import { dirname } from 'node:path';
import type { AgentToolResult, ExtensionAPI, SlashCommandInfo } from '@earendil-works/pi-coding-agent';
import { parseFrontmatter } from '@earendil-works/pi-coding-agent';
import { Type } from '@sinclair/typebox';

const SKILL_COMMAND_PREFIX = 'skill:';

interface SkillToolFrontmatter {
  readonly 'disable-model-invocation'?: boolean;
  readonly [key: string]: unknown;
}

interface LoadSkillToolParams {
  readonly name: string;
}

interface LoadSkillToolDetails {
  readonly name: string;
  readonly path?: string;
  readonly baseDir?: string;
}

interface SkillCommand {
  readonly name: string;
  readonly filePath: string;
}

export interface SkillLoadingToolOperations {
  readonly readFile: (path: string) => Promise<string>;
}

const defaultOperations: SkillLoadingToolOperations = {
  readFile: (path) => readFile(path, 'utf-8'),
};

function normalizeRequestedSkillName(name: string): string {
  const trimmed = name.trim();
  return trimmed.startsWith(SKILL_COMMAND_PREFIX) ? trimmed.slice(SKILL_COMMAND_PREFIX.length) : trimmed;
}

function toSkillCommand(command: SlashCommandInfo): SkillCommand | undefined {
  if (command.source !== 'skill' || !command.name.startsWith(SKILL_COMMAND_PREFIX)) {
    return;
  }

  return {
    name: command.name.slice(SKILL_COMMAND_PREFIX.length),
    filePath: command.sourceInfo.path,
  };
}

function formatAvailableSkills(names: readonly string[]): string {
  return names.length > 0 ? names.join(', ') : '(none)';
}

function parseSkillContent(rawContent: string): { readonly disabled: boolean; readonly body: string } {
  const { frontmatter, body } = parseFrontmatter<SkillToolFrontmatter>(rawContent);

  return {
    disabled: frontmatter['disable-model-invocation'] === true,
    body: body.trim(),
  };
}

function escapeXmlAttribute(value: string): string {
  return value.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

async function findInvocableSkillNames(
  skillCommands: readonly SkillCommand[],
  operations: SkillLoadingToolOperations,
): Promise<readonly string[]> {
  const names: string[] = [];

  for (const skillCommand of skillCommands) {
    try {
      const content = await operations.readFile(skillCommand.filePath);
      const parsed = parseSkillContent(content);
      if (!parsed.disabled) {
        names.push(skillCommand.name);
      }
    } catch {
      // If a skill file cannot be read while preparing an error message, do not
      // advertise it as available. A direct load attempt will report the read error.
    }
  }

  return names.sort((left, right) => left.localeCompare(right));
}

function createLoadSkillError(message: string, availableSkills?: readonly string[]): Error {
  const suffix = availableSkills ? `\nAvailable skills: ${formatAvailableSkills(availableSkills)}` : '';
  return new Error(`${message}${suffix}`);
}

export async function executeLoadSkillTool(
  pi: Pick<ExtensionAPI, 'getCommands'>,
  params: LoadSkillToolParams,
  operations: SkillLoadingToolOperations = defaultOperations,
): Promise<AgentToolResult<LoadSkillToolDetails>> {
  const requestedName = normalizeRequestedSkillName(params.name);
  const skillCommands = pi
    .getCommands()
    .map(toSkillCommand)
    .filter((command) => command !== undefined);

  if (requestedName.length === 0) {
    const availableSkills = await findInvocableSkillNames(skillCommands, operations);
    throw createLoadSkillError('Parameter "name" must be a non-empty skill name.', availableSkills);
  }

  const skillCommand = skillCommands.find((command) => command.name === requestedName);
  if (!skillCommand) {
    const availableSkills = await findInvocableSkillNames(skillCommands, operations);
    throw createLoadSkillError(`Skill "${requestedName}" not found.`, availableSkills);
  }

  let rawContent: string;
  try {
    rawContent = await operations.readFile(skillCommand.filePath);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    throw createLoadSkillError(`Failed to read skill "${requestedName}" from ${skillCommand.filePath}: ${message}`);
  }

  const parsed = parseSkillContent(rawContent);
  if (parsed.disabled) {
    throw createLoadSkillError(
      `Skill "${requestedName}" cannot be loaded by the model because disable-model-invocation is true.`,
    );
  }

  const baseDir = dirname(skillCommand.filePath);
  const text = `<skill name="${escapeXmlAttribute(requestedName)}" location="${escapeXmlAttribute(skillCommand.filePath)}">\nReferences are relative to ${baseDir}.\n\n${parsed.body}\n</skill>`;

  return {
    content: [{ type: 'text', text }],
    details: {
      name: requestedName,
      path: skillCommand.filePath,
      baseDir,
    },
  };
}

export function registerSkillLoadingTool(
  pi: Pick<ExtensionAPI, 'getCommands' | 'registerTool'>,
  operations: SkillLoadingToolOperations = defaultOperations,
): void {
  pi.registerTool({
    name: 'skill',
    label: 'Skill',
    description:
      'Load a skill by exact name and return its full instructions. ' +
      'Use this for skills listed in <available_skills>; the catalog is routing metadata only, ' +
      'while this tool returns the actual SKILL.md instructions.',
    promptSnippet: 'Load a skill by exact name and return its full instructions',
    promptGuidelines: [
      'Use the `skill` tool to load a matching skill from <available_skills> before planning, answering, editing files, or running commands.',
      'When loading a skill, call the `skill` tool with the exact skill name as the only tool call in that assistant turn; then follow the returned instructions.',
      'Use skill names exactly as listed in <available_skills>; do not invent names or use filesystem paths as the `skill` tool name.',
      'When a loaded skill references relative files or scripts, resolve them relative to the base directory returned by the `skill` tool.',
    ],
    parameters: Type.Object({
      name: Type.String({
        description: 'Exact skill name from <available_skills>. Do not include arguments or a filesystem path.',
      }),
    }),
    async execute(_toolCallId, params): Promise<AgentToolResult<LoadSkillToolDetails>> {
      return executeLoadSkillTool(pi, params, operations);
    },
  });
}
