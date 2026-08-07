import type { Dirent } from 'node:fs';
import { mkdirSync } from 'node:fs';
import { readdir, readFile } from 'node:fs/promises';
import { homedir } from 'node:os';
import { basename, dirname, join, relative, resolve, sep } from 'node:path';
import { Type } from '@earendil-works/pi-ai';
import type {
  AgentToolResult,
  ExtensionAPI,
  SlashCommandInfo,
  Theme,
  ToolDefinition,
} from '@earendil-works/pi-coding-agent';
import { keyHint, parseFrontmatter } from '@earendil-works/pi-coding-agent';
import { Text } from '@earendil-works/pi-tui';
import Database from 'better-sqlite3';

const SKILL_COMMAND_PREFIX = 'skill:';
const SKILL_FILE_NAME = 'SKILL.md';
const MAX_ADDITIONAL_CONTENT_ENTRIES_PER_SECTION = 40;
const MAX_EXTRA_CONTENT_COUNT = 200;
const IGNORED_ADDITIONAL_CONTENT_NAMES = new Set(['.DS_Store', '.git', 'node_modules', 'dist', '__pycache__']);

const WELL_KNOWN_CONTENT_SECTIONS = [
  { directory: 'references', sectionTag: 'references', itemTag: 'reference' },
  { directory: 'scripts', sectionTag: 'scripts', itemTag: 'script' },
  { directory: 'assets', sectionTag: 'assets', itemTag: 'asset' },
] as const;

const SKILL_METRICS_DB_PATH = join(homedir(), '.sandpiper', 'agent', 'skill_metrics.sqlite3');

type SkillRenderTheme = Pick<Theme, 'fg'>;

const EXPAND_KEYBINDING: Parameters<typeof keyHint>[0] = 'app.tools.expand';

interface SkillToolFrontmatter {
  readonly name?: unknown;
  readonly description?: unknown;
  readonly 'disable-model-invocation'?: boolean;
  readonly [key: string]: unknown;
}

type SkillToolSource = 'catalog' | 'filesystem';

interface SkillToolParams {
  readonly source?: SkillToolSource;
  readonly name?: string;
  readonly path?: string;
}

interface SkillToolDetails {
  readonly name: string;
  readonly path: string;
  readonly baseDir: string;
  readonly additionalContent?: SkillAdditionalContentDetails;
}

interface SkillCommand {
  readonly name: string;
  readonly filePath: string;
}

interface DirectoryEntry {
  readonly name: string;
  readonly isFile: () => boolean;
  readonly isDirectory: () => boolean;
  readonly isSymbolicLink: () => boolean;
}

interface EnumeratedContentSection {
  readonly sectionTag: string;
  readonly itemTag: string;
  readonly entries: readonly string[];
  readonly truncated: boolean;
}

interface ExtraContentSummary {
  readonly path: string;
  readonly files: number;
  readonly directories: number;
  readonly truncated: boolean;
}

interface SkillAdditionalContentDetails {
  readonly references: number;
  readonly scripts: number;
  readonly assets: number;
  readonly extras: number;
  readonly truncated: boolean;
  readonly sections: readonly EnumeratedContentSection[];
  readonly other: readonly ExtraContentSummary[];
}

interface AdditionalContentIndex {
  readonly sections: readonly EnumeratedContentSection[];
  readonly extras: readonly ExtraContentSummary[];
}

export interface SkillActivationEvent {
  readonly name: string;
  readonly source: SkillToolSource;
}

export interface SkillLoadingToolOperations {
  readonly readFile: (path: string) => Promise<string>;
  readonly readDir?: (path: string) => Promise<readonly DirectoryEntry[]>;
  readonly recordSkillActivation?: (event: SkillActivationEvent) => Promise<void> | void;
}

const defaultOperations: SkillLoadingToolOperations = {
  readFile: (path) => readFile(path, 'utf-8'),
  readDir: (path) => readdir(path, { withFileTypes: true }) as Promise<readonly Dirent[]>,
  recordSkillActivation: recordSkillActivationCount,
};

export function recordSkillActivationCount(event: SkillActivationEvent, dbPath = SKILL_METRICS_DB_PATH): void {
  mkdirSync(dirname(dbPath), { recursive: true });

  const database = new Database(dbPath);
  try {
    database.exec(`
      CREATE TABLE IF NOT EXISTS skill_activation_counts (
        skill_name TEXT NOT NULL,
        source TEXT NOT NULL,
        count INTEGER NOT NULL DEFAULT 0,
        first_seen_at TEXT NOT NULL,
        last_seen_at TEXT NOT NULL,
        PRIMARY KEY (skill_name, source)
      );
    `);

    const now = new Date().toISOString();
    database
      .prepare(`
        INSERT INTO skill_activation_counts (skill_name, source, count, first_seen_at, last_seen_at)
        VALUES (?, ?, 1, ?, ?)
        ON CONFLICT(skill_name, source) DO UPDATE SET
          count = count + 1,
          last_seen_at = excluded.last_seen_at
      `)
      .run(event.name, event.source, now, now);
  } finally {
    database.close();
  }
}

async function recordSkillActivationSafely(
  operations: SkillLoadingToolOperations,
  event: SkillActivationEvent,
): Promise<void> {
  try {
    await operations.recordSkillActivation?.(event);
  } catch {
    // Skill metrics are diagnostic only. A locked, missing, or corrupt metrics
    // database must never block the model from loading instructions it needs.
  }
}

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

function optionalFrontmatterString(value: unknown): string | undefined {
  return typeof value === 'string' && value.trim().length > 0 ? value.trim() : undefined;
}

function parseSkillContent(rawContent: string): {
  readonly name?: string;
  readonly description?: string;
  readonly disabled: boolean;
  readonly body: string;
} {
  const { frontmatter, body } = parseFrontmatter<SkillToolFrontmatter>(rawContent);

  return {
    name: optionalFrontmatterString(frontmatter.name),
    description: optionalFrontmatterString(frontmatter.description),
    disabled: frontmatter['disable-model-invocation'] === true,
    body: body.trim(),
  };
}

function escapeXmlAttribute(value: string): string {
  return value.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function toRelativeSkillPath(baseDir: string, path: string): string {
  return relative(baseDir, path).split(sep).join('/');
}

function isIgnoredAdditionalContent(entryName: string): boolean {
  return IGNORED_ADDITIONAL_CONTENT_NAMES.has(entryName);
}

async function readDirIfAvailable(
  operations: SkillLoadingToolOperations,
  path: string,
): Promise<readonly DirectoryEntry[] | undefined> {
  if (!operations.readDir) return;

  try {
    return await operations.readDir(path);
  } catch {
    return;
  }
}

async function enumerateContentFiles(
  operations: SkillLoadingToolOperations,
  baseDir: string,
  directory: string,
  maxEntries: number,
): Promise<{ readonly entries: readonly string[]; readonly truncated: boolean }> {
  const rootPath = join(baseDir, directory);
  const pending = [rootPath];
  const entries: string[] = [];
  let truncated = false;

  while (pending.length > 0) {
    const currentPath = pending.shift();
    if (!currentPath) break;

    const dirEntries = await readDirIfAvailable(operations, currentPath);
    if (!dirEntries) continue;

    for (const entry of [...dirEntries].sort((left, right) => left.name.localeCompare(right.name))) {
      if (isIgnoredAdditionalContent(entry.name) || entry.isSymbolicLink()) continue;

      if (entries.length >= maxEntries && (entry.isFile() || entry.isDirectory())) {
        truncated = true;
        return { entries: entries.sort((left, right) => left.localeCompare(right)), truncated };
      }

      const entryPath = join(currentPath, entry.name);
      if (entry.isFile()) {
        entries.push(toRelativeSkillPath(baseDir, entryPath));
      } else if (entry.isDirectory()) {
        pending.push(entryPath);
      }
    }
  }

  return { entries: entries.sort((left, right) => left.localeCompare(right)), truncated };
}

async function countExtraContent(
  operations: SkillLoadingToolOperations,
  rootPath: string,
): Promise<{ readonly files: number; readonly directories: number; readonly truncated: boolean }> {
  const pending = [rootPath];
  let files = 0;
  let directories = 0;
  const truncated = false;

  while (pending.length > 0) {
    const currentPath = pending.shift();
    if (!currentPath) break;

    const dirEntries = await readDirIfAvailable(operations, currentPath);
    if (!dirEntries) continue;

    for (const entry of dirEntries) {
      if (isIgnoredAdditionalContent(entry.name) || entry.isSymbolicLink()) continue;

      if (files + directories >= MAX_EXTRA_CONTENT_COUNT) {
        return { files, directories, truncated: true };
      }

      if (entry.isFile()) {
        files += 1;
      } else if (entry.isDirectory()) {
        directories += 1;
        pending.push(join(currentPath, entry.name));
      }
    }
  }

  return { files, directories, truncated };
}

async function buildAdditionalContentIndex(
  operations: SkillLoadingToolOperations,
  baseDir: string,
): Promise<AdditionalContentIndex | undefined> {
  const rootEntries = await readDirIfAvailable(operations, baseDir);
  if (!rootEntries) return;

  const rootDirectoryNames = new Set(rootEntries.filter((entry) => entry.isDirectory()).map((entry) => entry.name));
  const sections: EnumeratedContentSection[] = [];

  for (const section of WELL_KNOWN_CONTENT_SECTIONS) {
    if (!rootDirectoryNames.has(section.directory)) continue;

    const enumerated = await enumerateContentFiles(
      operations,
      baseDir,
      section.directory,
      MAX_ADDITIONAL_CONTENT_ENTRIES_PER_SECTION,
    );

    if (enumerated.entries.length > 0 || enumerated.truncated) {
      sections.push({
        sectionTag: section.sectionTag,
        itemTag: section.itemTag,
        entries: enumerated.entries,
        truncated: enumerated.truncated,
      });
    }
  }

  const wellKnownDirectoryNames = new Set<string>(WELL_KNOWN_CONTENT_SECTIONS.map((section) => section.directory));
  const directExtraFiles = rootEntries.filter(
    (entry) =>
      entry.isFile() &&
      entry.name !== SKILL_FILE_NAME &&
      !wellKnownDirectoryNames.has(entry.name) &&
      !isIgnoredAdditionalContent(entry.name),
  ).length;
  const extraDirectories = rootEntries.filter(
    (entry) =>
      entry.isDirectory() && !wellKnownDirectoryNames.has(entry.name) && !isIgnoredAdditionalContent(entry.name),
  );
  const extras: ExtraContentSummary[] = [];

  if (directExtraFiles > 0) {
    extras.push({ path: '.', files: directExtraFiles, directories: 0, truncated: false });
  }

  for (const entry of [...extraDirectories].sort((left, right) => left.name.localeCompare(right.name))) {
    const summary = await countExtraContent(operations, join(baseDir, entry.name));
    extras.push({ path: entry.name, ...summary });
  }

  if (sections.length === 0 && extras.length === 0) return;

  return { sections, extras };
}

function formatAdditionalContentIndex(index: AdditionalContentIndex): string {
  const lines = ['<additional_content>'];

  for (const section of index.sections) {
    lines.push(`<${section.sectionTag} count="${section.entries.length}" truncated="${String(section.truncated)}">`);
    for (const entry of section.entries) {
      lines.push(`<${section.itemTag} path="${escapeXmlAttribute(entry)}" />`);
    }
    lines.push(`</${section.sectionTag}>`);
  }

  if (index.extras.length > 0) {
    const extrasTruncated = index.extras.some((extra) => extra.truncated);
    lines.push(`<other count="${index.extras.length}" truncated="${String(extrasTruncated)}">`);
    for (const extra of index.extras) {
      lines.push(
        `<content path="${escapeXmlAttribute(extra.path)}" files="${extra.files}" directories="${extra.directories}" truncated="${String(extra.truncated)}" />`,
      );
    }
    lines.push('</other>');
  }

  lines.push('</additional_content>');
  return lines.join('\n');
}

function describeAdditionalContent(
  index: AdditionalContentIndex | undefined,
): SkillAdditionalContentDetails | undefined {
  if (!index) return;

  const sectionCounts = new Map(index.sections.map((section) => [section.sectionTag, section.entries.length]));
  return {
    references: sectionCounts.get('references') ?? 0,
    scripts: sectionCounts.get('scripts') ?? 0,
    assets: sectionCounts.get('assets') ?? 0,
    extras: index.extras.length,
    truncated: index.sections.some((section) => section.truncated) || index.extras.some((extra) => extra.truncated),
    sections: index.sections,
    other: index.extras,
  };
}

async function findInvocableSkillNames(
  skillCommands: readonly SkillCommand[],
  operations: SkillLoadingToolOperations,
): Promise<readonly string[]> {
  const names = new Set<string>();

  for (const skillCommand of skillCommands) {
    try {
      const content = await operations.readFile(skillCommand.filePath);
      const parsed = parseSkillContent(content);
      if (!parsed.disabled) {
        names.add(skillCommand.name);
      }
    } catch {
      // If a skill file cannot be read while preparing an error message, do not
      // advertise it as available. A direct load attempt will report the read error.
    }
  }

  return [...names].sort((left, right) => left.localeCompare(right));
}

function createSkillToolError(message: string, availableSkills?: readonly string[]): Error {
  const suffix = availableSkills ? `\nAvailable skills: ${formatAvailableSkills(availableSkills)}` : '';
  return new Error(`${message}${suffix}`);
}

function plural(count: number, singular: string, pluralForm = `${singular}s`): string {
  return `${count} ${count === 1 ? singular : pluralForm}`;
}

function extractTextContent(result: AgentToolResult<unknown>): string {
  return result.content
    .map((block) => (block.type === 'text' ? block.text : ''))
    .filter((text) => text.length > 0)
    .join('\n');
}

function extractInstructionsFromResult(result: AgentToolResult<SkillToolDetails>): string {
  const text = extractTextContent(result);
  const match = text.match(/<instructions>\n?([\s\S]*)\n?<\/instructions>/);
  const instructions = match?.[1]?.trim() ?? text.trim();
  const baseDir = result.details.baseDir;
  const relativeReferencePrefix = `References are relative to ${baseDir}.\n\n`;

  return instructions.startsWith(relativeReferencePrefix)
    ? instructions.slice(relativeReferencePrefix.length).trim()
    : instructions;
}

function formatSkillLabel(name: string, theme: SkillRenderTheme): string {
  return theme.fg('customMessageLabel', `\x1b[1m[skill]\x1b[22m `) + theme.fg('customMessageText', name);
}

function formatSkillNameFromArgs(args: SkillToolParams): string {
  if (args.source === 'filesystem') {
    const path = typeof args.path === 'string' ? args.path.trim() : '';
    return path.length > 0 ? path : '...';
  }

  const name = typeof args.name === 'string' ? normalizeRequestedSkillName(args.name) : '';
  return name.length > 0 ? name : '...';
}

function formatAdditionalContentSummary(details: SkillAdditionalContentDetails | undefined): string[] {
  if (!details) return [];

  const parts: string[] = [];
  if (details.references > 0) parts.push(plural(details.references, 'ref'));
  if (details.scripts > 0) parts.push(plural(details.scripts, 'script'));
  if (details.assets > 0) parts.push(plural(details.assets, 'asset'));
  if (details.extras > 0) parts.push(plural(details.extras, 'additional content group'));
  if (details.truncated) parts.push('truncated');
  return parts;
}

function formatExtraContentSummary(extra: ExtraContentSummary): string {
  const counts = [plural(extra.files, 'file'), plural(extra.directories, 'dir')];
  const suffix = extra.truncated ? ', truncated' : '';
  return `${extra.path} — ${counts.join(', ')}${suffix}`;
}

function formatAdditionalContentForDisplay(
  details: SkillAdditionalContentDetails | undefined,
  theme: SkillRenderTheme,
): string[] {
  if (!details) return [];

  const lines = [theme.fg('muted', 'Additional content:')];
  for (const section of details.sections) {
    const suffix = section.truncated ? ', truncated' : '';
    lines.push(`  ${section.sectionTag} (${section.entries.length}${suffix}):`);
    for (const entry of section.entries) {
      lines.push(`    ${entry}`);
    }
  }

  if (details.other.length > 0) {
    lines.push('  other:');
    for (const extra of details.other) {
      lines.push(`    ${formatExtraContentSummary(extra)}`);
    }
  }

  return lines;
}

function formatExpandHint(expanded: boolean): string {
  return expanded ? '' : ` (${keyHint(EXPAND_KEYBINDING, 'to expand')})`;
}

function formatSkillRenderHeader(
  name: string,
  additionalContent: SkillAdditionalContentDetails | undefined,
  expanded: boolean,
  theme: SkillRenderTheme,
): string {
  const metadata = formatAdditionalContentSummary(additionalContent);
  const metadataText = metadata.length > 0 ? theme.fg('dim', ` · ${metadata.join(' · ')}`) : '';
  return `${formatSkillLabel(name, theme)}${metadataText}${formatExpandHint(expanded)}`;
}

function reuseTextComponent(component: unknown): Text {
  return typeof (component as { readonly setText?: unknown } | undefined)?.setText === 'function'
    ? (component as Text)
    : new Text('', 0, 0);
}

function formatSkillExpandedResult(result: AgentToolResult<SkillToolDetails>, theme: SkillRenderTheme): string {
  const details = result.details;
  const metadataLines = [
    formatSkillRenderHeader(details.name, details.additionalContent, true, theme),
    '',
    `${theme.fg('muted', 'Location:')} ${theme.fg('accent', details.path)}`,
    `${theme.fg('muted', 'Base dir:')} ${theme.fg('accent', details.baseDir)}`,
  ];
  const additionalContentLines = formatAdditionalContentForDisplay(details.additionalContent, theme);
  const instructions = extractInstructionsFromResult(result);

  return [
    ...metadataLines,
    ...(additionalContentLines.length > 0 ? ['', ...additionalContentLines] : []),
    '',
    theme.fg('muted', 'Instructions:'),
    theme.fg('toolOutput', instructions),
  ].join('\n');
}

async function readSkillFile(
  operations: SkillLoadingToolOperations,
  skillNameOrPath: string,
  filePath: string,
): Promise<string> {
  try {
    return await operations.readFile(filePath);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    throw createSkillToolError(`Failed to read skill "${skillNameOrPath}" from ${filePath}: ${message}`);
  }
}

async function formatSkillToolResult(
  name: string,
  filePath: string,
  baseDir: string,
  parsed: ReturnType<typeof parseSkillContent>,
  operations: SkillLoadingToolOperations,
): Promise<AgentToolResult<SkillToolDetails>> {
  if (parsed.disabled) {
    throw createSkillToolError(
      `Skill "${name}" cannot be loaded by the model because disable-model-invocation is true.`,
    );
  }

  const additionalContent = await buildAdditionalContentIndex(operations, baseDir);
  const additionalContentText = additionalContent ? `${formatAdditionalContentIndex(additionalContent)}\n\n` : '';
  const text = `<skill name="${escapeXmlAttribute(name)}" location="${escapeXmlAttribute(filePath)}">\n${additionalContentText}<instructions>\nReferences are relative to ${baseDir}.\n\n${parsed.body}\n</instructions>\n</skill>`;

  return {
    content: [{ type: 'text', text }],
    details: {
      name,
      path: filePath,
      baseDir,
      additionalContent: describeAdditionalContent(additionalContent),
    },
  };
}

async function executeCatalogSkillTool(
  pi: Pick<ExtensionAPI, 'getCommands'>,
  params: SkillToolParams,
  operations: SkillLoadingToolOperations,
): Promise<AgentToolResult<SkillToolDetails>> {
  const requestedName = typeof params.name === 'string' ? normalizeRequestedSkillName(params.name) : '';
  const skillCommands = pi
    .getCommands()
    .map(toSkillCommand)
    .filter((command) => command !== undefined);

  if (requestedName.length === 0) {
    const availableSkills = await findInvocableSkillNames(skillCommands, operations);
    throw createSkillToolError('Parameter "name" must be a non-empty skill name.', availableSkills);
  }

  const skillCommand = skillCommands.find((command) => command.name === requestedName);
  if (!skillCommand) {
    const availableSkills = await findInvocableSkillNames(skillCommands, operations);
    throw createSkillToolError(`Skill "${requestedName}" not found.`, availableSkills);
  }

  const rawContent = await readSkillFile(operations, requestedName, skillCommand.filePath);
  const parsed = parseSkillContent(rawContent);
  return formatSkillToolResult(
    requestedName,
    skillCommand.filePath,
    dirname(skillCommand.filePath),
    parsed,
    operations,
  );
}

function resolveFilesystemSkillTarget(target: string): { readonly filePath: string; readonly baseDir: string } {
  const resolvedTarget = resolve(target);

  if (basename(resolvedTarget) === SKILL_FILE_NAME) {
    return { filePath: resolvedTarget, baseDir: dirname(resolvedTarget) };
  }

  return { filePath: join(resolvedTarget, SKILL_FILE_NAME), baseDir: resolvedTarget };
}

async function executeFilesystemSkillTool(
  params: SkillToolParams,
  operations: SkillLoadingToolOperations,
): Promise<AgentToolResult<SkillToolDetails>> {
  const requestedPath = typeof params.path === 'string' ? params.path.trim() : '';
  if (requestedPath.length === 0) {
    throw createSkillToolError('Parameter "path" must be a non-empty filesystem path.');
  }

  const { filePath, baseDir } = resolveFilesystemSkillTarget(requestedPath);
  const rawContent = await readSkillFile(operations, filePath, filePath);
  const parsed = parseSkillContent(rawContent);
  const name = parsed.name ?? basename(baseDir);

  if (!parsed.description) {
    throw createSkillToolError(
      `Filesystem skill "${name}" from ${filePath} cannot be loaded because description is missing.`,
    );
  }

  return formatSkillToolResult(name, filePath, baseDir, parsed, operations);
}

export async function executeSkillTool(
  pi: Pick<ExtensionAPI, 'getCommands'>,
  params: SkillToolParams,
  operations: SkillLoadingToolOperations = defaultOperations,
): Promise<AgentToolResult<SkillToolDetails>> {
  const source = params.source ?? 'catalog';
  const result =
    source === 'filesystem'
      ? await executeFilesystemSkillTool(params, operations)
      : await executeCatalogSkillTool(pi, params, operations);

  await recordSkillActivationSafely(operations, { name: result.details.name, source });
  return result;
}

export function registerSkillLoadingTool(
  pi: Pick<ExtensionAPI, 'getCommands' | 'registerTool'>,
  operations: SkillLoadingToolOperations = defaultOperations,
): void {
  const parameters = Type.Object({
    source: Type.Optional(
      Type.Union([Type.Literal('catalog'), Type.Literal('filesystem')], {
        description: 'Skill resolution source. Defaults to catalog.',
      }),
    ),
    name: Type.Optional(
      Type.String({
        description: 'Exact skill name from <available_skills>. Required when source is catalog.',
        minLength: 1,
      }),
    ),
    path: Type.Optional(
      Type.String({
        description:
          'Explicit filesystem path to SKILL.md or a directory containing SKILL.md. Required when source is filesystem.',
        minLength: 1,
      }),
    ),
  });

  const tool: ToolDefinition<typeof parameters, SkillToolDetails> = {
    name: 'skill',
    label: 'Skill',
    description:
      'Load a skill by name from the catalogue, or from an explicit filesystem path when the user asks for a non-catalogued skill.',
    promptSnippet: 'Load a skill by name or explicit filesystem path and return its full instructions',
    promptGuidelines: [
      'Use the `skill` tool to load a skill by name.',
      'Use `source="filesystem"` only when the user explicitly asks to load a non-catalogued skill from a filesystem path.',
    ],
    // 'prefer': strict JSON-schema sampling when the model supports it, transparent fallback
    // otherwise. source is a Type.Union of two Type.Literal strings -- verified this compiles
    // to plain {anyOf:[{type:'string',const:...}, ...]}, no nonstandard keywords a strict-mode
    // provider could reject.
    constrainedSampling: { type: 'json_schema', strict: 'prefer' },
    parameters,
    renderCall(args, theme, context) {
      const text = reuseTextComponent(context.lastComponent);
      text.setText(
        context.isPartial ? formatSkillRenderHeader(formatSkillNameFromArgs(args), undefined, false, theme) : '',
      );
      return text;
    },
    renderResult(result, options, theme, context) {
      const text = reuseTextComponent(context.lastComponent);

      if (context.isError) {
        text.setText(extractTextContent(result));
      } else if (!options.expanded) {
        text.setText(formatSkillRenderHeader(result.details.name, result.details.additionalContent, false, theme));
      } else {
        text.setText(formatSkillExpandedResult(result, theme));
      }

      return text;
    },
    async execute(_toolCallId, params): Promise<AgentToolResult<SkillToolDetails>> {
      return executeSkillTool(pi, params, operations);
    },
  };

  pi.registerTool(tool);
}
