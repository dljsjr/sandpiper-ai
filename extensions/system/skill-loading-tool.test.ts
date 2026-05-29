import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import type { AgentToolResult, ExtensionAPI, SlashCommandInfo, ToolDefinition } from '@earendil-works/pi-coding-agent';
import { initTheme } from '@earendil-works/pi-coding-agent';
import { KeybindingsManager, setKeybindings } from '@earendil-works/pi-tui';
import Database from 'better-sqlite3';
import { beforeAll, describe, expect, it, vi } from 'vitest';
import {
  executeSkillTool,
  recordSkillActivationCount,
  registerSkillLoadingTool,
  type SkillLoadingToolOperations,
} from './skill-loading-tool.js';

interface SkillToolTestDetails {
  readonly name: string;
  readonly path: string;
  readonly baseDir: string;
  readonly additionalContent?: {
    readonly references: number;
    readonly scripts: number;
    readonly assets: number;
    readonly extras: number;
    readonly truncated: boolean;
  };
}

interface SkillToolTestParams {
  readonly source?: 'catalog' | 'filesystem';
  readonly name?: string;
  readonly path?: string;
}

interface TestDirectoryEntry {
  readonly name: string;
  readonly isFile: () => boolean;
  readonly isDirectory: () => boolean;
  readonly isSymbolicLink: () => boolean;
}

type RegisteredTool = ToolDefinition;

function createSkillCommand(name: string, filePath: string, description: string = `${name} skill`): SlashCommandInfo {
  return {
    name: `skill:${name}`,
    description,
    source: 'skill',
    sourceInfo: {
      path: filePath,
      source: 'local',
      scope: 'project',
      origin: 'top-level',
      baseDir: '/repo/.sandpiper/skills',
    },
  };
}

function createPromptCommand(name: string): SlashCommandInfo {
  return {
    name,
    description: `${name} prompt`,
    source: 'prompt',
    sourceInfo: {
      path: `/repo/.sandpiper/prompts/${name}.md`,
      source: 'local',
      scope: 'project',
      origin: 'top-level',
    },
  };
}

function createToolRegistrationStub(commands: readonly SlashCommandInfo[]): {
  readonly pi: Pick<ExtensionAPI, 'getCommands' | 'registerTool'>;
  readonly tools: RegisteredTool[];
} {
  const tools: RegisteredTool[] = [];

  return {
    pi: {
      getCommands: vi.fn(() => [...commands]) as ExtensionAPI['getCommands'],
      registerTool: ((tool: RegisteredTool) => {
        tools.push(tool);
      }) as ExtensionAPI['registerTool'],
    },
    tools,
  };
}

function createReadOperations(
  files: Readonly<Record<string, string>>,
  directories?: Readonly<Record<string, readonly TestDirectoryEntry[]>>,
): SkillLoadingToolOperations {
  const operations: SkillLoadingToolOperations = {
    readFile: vi.fn(async (path: string) => {
      const content = files[path];
      if (content === undefined) {
        throw new Error(`ENOENT: ${path}`);
      }
      return content;
    }),
  };

  if (!directories) return operations;

  return {
    ...operations,
    readDir: vi.fn(async (path: string) => {
      const entries = directories[path];
      if (!entries) {
        throw new Error(`ENOENT: ${path}`);
      }
      return entries;
    }),
  };
}

function fileEntry(name: string): TestDirectoryEntry {
  return {
    name,
    isFile: () => true,
    isDirectory: () => false,
    isSymbolicLink: () => false,
  };
}

function directoryEntry(name: string): TestDirectoryEntry {
  return {
    name,
    isFile: () => false,
    isDirectory: () => true,
    isSymbolicLink: () => false,
  };
}

function skillFile(description: string, body: string, extraFrontmatter: string = ''): string {
  return `---\ndescription: ${JSON.stringify(description)}\n${extraFrontmatter}---\n${body}`;
}

async function executeRegisteredTool(
  tool: RegisteredTool,
  params: SkillToolTestParams,
): Promise<AgentToolResult<SkillToolTestDetails>> {
  return tool.execute(
    'tool-call-id',
    params,
    undefined,
    undefined,
    {} as Parameters<RegisteredTool['execute']>[4],
  ) as Promise<AgentToolResult<SkillToolTestDetails>>;
}

function resultText(result: AgentToolResult<SkillToolTestDetails>): string {
  const firstContent = result.content[0];
  if (firstContent?.type !== 'text') {
    throw new Error('Expected first tool result content block to be text');
  }
  return firstContent.text;
}

const ansiEscapePattern = new RegExp(`${String.fromCharCode(27)}\\[[0-9;]*m`, 'g');

function renderComponentText(component: { render: (width: number) => string[] }): string {
  return component
    .render(500)
    .map((line) => line.replace(ansiEscapePattern, '').trimEnd())
    .join('\n');
}

const testTheme = {
  fg: (_color: string, text: string) => text,
};

async function expectRejectedMessage(promise: Promise<unknown>): Promise<string> {
  try {
    await promise;
  } catch (error) {
    if (error instanceof Error) return error.message;
    return String(error);
  }

  throw new Error('Expected promise to reject');
}

describe('registerSkillLoadingTool', () => {
  beforeAll(() => {
    initTheme(undefined, false);
    setKeybindings(
      new KeybindingsManager({
        'app.tools.expand': { defaultKeys: 'ctrl+o', description: 'Toggle tool output' },
      }),
    );
  });

  it('registers skill with prompt guidance for model-driven skill loading', () => {
    const { pi, tools } = createToolRegistrationStub([]);

    registerSkillLoadingTool(pi);

    expect(tools).toHaveLength(1);
    expect(tools[0]).toMatchObject({
      name: 'skill',
      label: 'Skill',
      promptSnippet: 'Load a skill by name or explicit filesystem path and return its full instructions',
    });
    expect(tools[0]?.description).toContain('SKILL.md instructions');
    expect(tools[0]?.promptGuidelines).toEqual(
      expect.arrayContaining([
        expect.stringContaining('Use the `skill` tool to load a matching skill'),
        expect.stringContaining('as the only tool call'),
      ]),
    );
  });

  it('loads skill instructions from Pi-discovered skill commands', async () => {
    const skillPath = '/repo/.sandpiper/skills/jj/SKILL.md';
    const { pi, tools } = createToolRegistrationStub([
      createPromptCommand('new-feature'),
      createSkillCommand('jj', skillPath, 'Jujutsu version control'),
    ]);
    const recordSkillActivation = vi.fn();
    const operations = {
      ...createReadOperations({
        [skillPath]: skillFile('Jujutsu version control', '# Jujutsu\n\nUse jj, not git.'),
      }),
      recordSkillActivation,
    } satisfies SkillLoadingToolOperations;

    registerSkillLoadingTool(pi, operations);

    const result = await executeRegisteredTool(tools[0]!, { name: 'jj' });

    expect(result.details).toEqual({
      name: 'jj',
      path: skillPath,
      baseDir: '/repo/.sandpiper/skills/jj',
    });
    expect(recordSkillActivation).toHaveBeenCalledWith({ name: 'jj', source: 'catalog' });
    const text = resultText(result);
    expect(text).toContain(`<skill name="jj" location="${skillPath}">`);
    expect(text).toContain('References are relative to /repo/.sandpiper/skills/jj.');
    expect(text).toContain('# Jujutsu\n\nUse jj, not git.');
    expect(text).not.toContain('description:');
  });

  it('surfaces additional content by enumerating well-known directories and summarizing extras', async () => {
    const baseDir = '/repo/.sandpiper/skills/streamlit';
    const skillPath = `${baseDir}/SKILL.md`;
    const { pi } = createToolRegistrationStub([createSkillCommand('streamlit', skillPath)]);
    const operations = createReadOperations(
      {
        [skillPath]: skillFile('Streamlit routing', '# Streamlit\n\nRoute to specialized files.'),
      },
      {
        [baseDir]: [
          fileEntry('SKILL.md'),
          directoryEntry('assets'),
          fileEntry('README.md'),
          directoryEntry('references'),
          directoryEntry('scripts'),
          directoryEntry('templates'),
          fileEntry('.DS_Store'),
        ],
        [`${baseDir}/assets`]: [fileEntry('logo.svg')],
        [`${baseDir}/references`]: [directoryEntry('deep'), fileEntry('guide.md')],
        [`${baseDir}/references/deep`]: [fileEntry('more.md')],
        [`${baseDir}/scripts`]: [fileEntry('run.sh')],
        [`${baseDir}/templates`]: [directoryEntry('app'), fileEntry('streamlit_app.py')],
        [`${baseDir}/templates/app`]: [fileEntry('nested.py')],
      },
    );

    const result = await executeSkillTool(pi, { name: 'streamlit' }, operations);

    expect(result.details.additionalContent).toMatchObject({
      references: 2,
      scripts: 1,
      assets: 1,
      extras: 2,
      truncated: false,
    });
    const text = resultText(result);
    expect(text.indexOf('<additional_content>')).toBeLessThan(text.indexOf('<instructions>'));
    expect(text).toContain('<additional_content>');
    expect(text).toContain('<references count="2" truncated="false">');
    expect(text).toContain('<reference path="references/deep/more.md" />');
    expect(text).toContain('<reference path="references/guide.md" />');
    expect(text).toContain('<scripts count="1" truncated="false">');
    expect(text).toContain('<script path="scripts/run.sh" />');
    expect(text).toContain('<assets count="1" truncated="false">');
    expect(text).toContain('<asset path="assets/logo.svg" />');
    expect(text).toContain('<other count="2" truncated="false">');
    expect(text).toContain('<content path="." files="1" directories="0" truncated="false" />');
    expect(text).toContain('<content path="templates" files="2" directories="1" truncated="false" />');
    expect(text).not.toContain('.DS_Store');
  });

  it('renders a compact result and structured expanded view', async () => {
    const baseDir = '/repo/.sandpiper/skills/streamlit';
    const skillPath = `${baseDir}/SKILL.md`;
    const { pi, tools } = createToolRegistrationStub([createSkillCommand('streamlit', skillPath)]);
    const operations = createReadOperations(
      {
        [skillPath]: skillFile('Streamlit routing', '# Streamlit\n\nRoute to specialized files.'),
      },
      {
        [baseDir]: [directoryEntry('references')],
        [`${baseDir}/references`]: [fileEntry('guide.md'), fileEntry('more.md')],
      },
    );
    registerSkillLoadingTool(pi, operations);

    const result = await executeRegisteredTool(tools[0]!, { name: 'streamlit' });
    const renderContext = { lastComponent: undefined, isError: false };

    const compactComponent = tools[0]!.renderResult!(
      result,
      { expanded: false, isPartial: false },
      testTheme as never,
      renderContext as never,
    );
    const compactText = renderComponentText(compactComponent);
    expect(compactText).toContain('[skill] streamlit');
    expect(compactText).toContain('2 refs');
    expect(compactText).toContain('ctrl+o to expand');
    expect(compactText).not.toContain('# Streamlit');

    const expandedComponent = tools[0]!.renderResult!(
      result,
      { expanded: true, isPartial: false },
      testTheme as never,
      renderContext as never,
    );
    const expandedText = renderComponentText(expandedComponent);
    expect(expandedText).toContain('[skill] streamlit');
    expect(expandedText).toContain(`Location: ${skillPath}`);
    expect(expandedText).toContain(`Base dir: ${baseDir}`);
    expect(expandedText).toContain('Additional content:');
    expect(expandedText).toContain('references (2):');
    expect(expandedText).toContain('references/guide.md');
    expect(expandedText).toContain('Instructions:');
    expect(expandedText).toContain('# Streamlit\n\nRoute to specialized files.');
    expect(expandedText).not.toContain('<additional_content>');
  });

  it('accepts an accidental skill: prefix but still resolves by exact skill name', async () => {
    const skillPath = '/repo/.sandpiper/skills/jj/SKILL.md';
    const { pi } = createToolRegistrationStub([createSkillCommand('jj', skillPath)]);
    const operations = createReadOperations({
      [skillPath]: skillFile('Jujutsu version control', 'Use jj.'),
    });

    const result = await executeSkillTool(pi, { name: 'skill:jj' }, operations);

    expect(result.details).toMatchObject({ name: 'jj', path: skillPath });
  });

  it('increments skill activation counts in sqlite', () => {
    const tempDir = mkdtempSync(join(tmpdir(), 'sandpiper-skill-metrics-'));
    const dbPath = join(tempDir, 'skill_metrics.sqlite3');
    try {
      recordSkillActivationCount({ name: 'jj', source: 'catalog' }, dbPath);
      recordSkillActivationCount({ name: 'jj', source: 'catalog' }, dbPath);
      recordSkillActivationCount({ name: 'tui', source: 'filesystem' }, dbPath);

      const database = new Database(dbPath, { readonly: true });
      try {
        expect(
          database
            .prepare('SELECT skill_name, source, count FROM skill_activation_counts ORDER BY skill_name, source')
            .all(),
        ).toEqual([
          { skill_name: 'jj', source: 'catalog', count: 2 },
          { skill_name: 'tui', source: 'filesystem', count: 1 },
        ]);
      } finally {
        database.close();
      }
    } finally {
      rmSync(tempDir, { recursive: true, force: true });
    }
  });

  it('records successful filesystem skill activations', async () => {
    const skillPath = '/outside/custom/SKILL.md';
    const operations = {
      ...createReadOperations({
        [skillPath]: skillFile('Custom local skill', '# Custom\n\nLocal instructions.', 'name: custom-local\n'),
      }),
      recordSkillActivation: vi.fn(),
    } satisfies SkillLoadingToolOperations;

    await executeSkillTool({ getCommands: () => [] }, { source: 'filesystem', path: skillPath }, operations);

    expect(operations.recordSkillActivation).toHaveBeenCalledWith({ name: 'custom-local', source: 'filesystem' });
  });

  it('does not let metrics failures break skill loading', async () => {
    const skillPath = '/repo/.sandpiper/skills/jj/SKILL.md';
    const operations = {
      ...createReadOperations({
        [skillPath]: skillFile('Jujutsu version control', '# Jujutsu\n\nUse jj, not git.'),
      }),
      recordSkillActivation: vi.fn(() => {
        throw new Error('database is locked');
      }),
    } satisfies SkillLoadingToolOperations;

    const result = await executeSkillTool(
      { getCommands: () => [createSkillCommand('jj', skillPath, 'Jujutsu version control')] },
      { name: 'jj' },
      operations,
    );

    expect(result.details.name).toBe('jj');
  });

  it('does not record failed skill loads', async () => {
    const skillPath = '/repo/.sandpiper/skills/disabled/SKILL.md';
    const operations = {
      ...createReadOperations({
        [skillPath]: skillFile('Disabled skill', '# Disabled', 'disable-model-invocation: true\n'),
      }),
      recordSkillActivation: vi.fn(),
    } satisfies SkillLoadingToolOperations;

    await expectRejectedMessage(
      executeSkillTool(
        { getCommands: () => [createSkillCommand('disabled', skillPath, 'Disabled skill')] },
        { name: 'disabled' },
        operations,
      ),
    );

    expect(operations.recordSkillActivation).not.toHaveBeenCalled();
  });

  it('loads a filesystem skill from an explicit SKILL.md path without catalog lookup', async () => {
    const skillPath = '/repo/on-demand-skills/streamlit/SKILL.md';
    const { pi } = createToolRegistrationStub([]);
    const operations = createReadOperations({
      [skillPath]: `---\nname: streamlit\ndescription: Streamlit routing\n---\n# Streamlit\n\nUse this when explicitly requested.`,
    });

    const result = await executeSkillTool(pi, { source: 'filesystem', path: skillPath }, operations);

    expect(pi.getCommands).not.toHaveBeenCalled();
    expect(result.details).toEqual({
      name: 'streamlit',
      path: skillPath,
      baseDir: '/repo/on-demand-skills/streamlit',
    });
    const text = resultText(result);
    expect(text).toContain(`<skill name="streamlit" location="${skillPath}">`);
    expect(text).toContain('References are relative to /repo/on-demand-skills/streamlit.');
    expect(text).toContain('# Streamlit\n\nUse this when explicitly requested.');
  });

  it('loads a filesystem skill from a directory containing SKILL.md', async () => {
    const skillDir = '/repo/on-demand-skills/streamlit';
    const skillPath = `${skillDir}/SKILL.md`;
    const { pi } = createToolRegistrationStub([]);
    const operations = createReadOperations({
      [skillPath]: skillFile('Streamlit routing', '# Streamlit'),
    });

    const result = await executeSkillTool(pi, { source: 'filesystem', path: skillDir }, operations);

    expect(result.details).toMatchObject({ name: 'streamlit', path: skillPath, baseDir: skillDir });
  });

  it('rejects filesystem skills hidden from model invocation', async () => {
    const skillPath = '/repo/on-demand-skills/hidden/SKILL.md';
    const { pi } = createToolRegistrationStub([]);
    const operations = createReadOperations({
      [skillPath]: skillFile('Hidden skill', 'Do not expose.', 'disable-model-invocation: true\n'),
    });

    await expect(executeSkillTool(pi, { source: 'filesystem', path: skillPath }, operations)).rejects.toThrow(
      'disable-model-invocation is true',
    );
  });

  it('requires an explicit filesystem path for filesystem skill loading', async () => {
    const { pi } = createToolRegistrationStub([]);

    const message = await expectRejectedMessage(
      executeSkillTool(pi, { source: 'filesystem' }, createReadOperations({})),
    );

    expect(message).toContain('Parameter "path" must be a non-empty filesystem path.');
  });

  it('reports unknown skills with only invocable skill names', async () => {
    const jjPath = '/repo/.sandpiper/skills/jj/SKILL.md';
    const hiddenPath = '/repo/.sandpiper/skills/hidden/SKILL.md';
    const { pi } = createToolRegistrationStub([
      createSkillCommand('jj', jjPath),
      createSkillCommand('hidden', hiddenPath),
    ]);
    const operations = createReadOperations({
      [jjPath]: skillFile('Jujutsu version control', 'Use jj.'),
      [hiddenPath]: skillFile('Hidden skill', 'Hidden body.', 'disable-model-invocation: true\n'),
    });

    const message = await expectRejectedMessage(executeSkillTool(pi, { name: 'missing' }, operations));

    expect(message).toContain('Skill "missing" not found.');
    expect(message).toContain('Available skills: jj');
    expect(message).not.toContain('hidden');
  });

  it('rejects skills hidden from model invocation', async () => {
    const skillPath = '/repo/.sandpiper/skills/hidden/SKILL.md';
    const { pi } = createToolRegistrationStub([createSkillCommand('hidden', skillPath)]);
    const operations = createReadOperations({
      [skillPath]: skillFile('Hidden skill', 'Do not expose.', 'disable-model-invocation: true\n'),
    });

    await expect(executeSkillTool(pi, { name: 'hidden' }, operations)).rejects.toThrow(
      'disable-model-invocation is true',
    );
  });

  it('returns a clear error when a discovered skill file cannot be read', async () => {
    const skillPath = '/repo/.sandpiper/skills/broken/SKILL.md';
    const { pi } = createToolRegistrationStub([createSkillCommand('broken', skillPath)]);
    const operations = createReadOperations({});

    const message = await expectRejectedMessage(executeSkillTool(pi, { name: 'broken' }, operations));

    expect(message).toContain('Failed to read skill "broken"');
    expect(message).toContain(`ENOENT: ${skillPath}`);
  });
});
