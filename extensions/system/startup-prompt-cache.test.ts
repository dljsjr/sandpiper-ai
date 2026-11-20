import { execFileSync } from 'node:child_process';
import { appendFileSync, cpSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { homedir, tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import type { BuildSystemPromptOptions } from '@earendil-works/pi-coding-agent';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { registerStartupPromptHooks } from './startup-hooks.js';

const mockGetAgentDir = vi.hoisted(() => vi.fn());
const templateDir = vi.hoisted((): { current?: string } => ({}));
const shippedTemplateDir = join(dirname(fileURLToPath(import.meta.url)), '../../packages/core/system-prompt');

vi.mock('@earendil-works/pi-coding-agent', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@earendil-works/pi-coding-agent')>()),
  getAgentDir: mockGetAgentDir,
}));
vi.mock('node:child_process', async (importOriginal) => ({
  ...(await importOriginal<typeof import('node:child_process')>()),
  execFileSync: vi.fn(),
}));
vi.mock('../../packages/core/src/system-prompt.js', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../packages/core/src/system-prompt.js')>();
  return {
    ...actual,
    loadSystemPromptTemplates: (dir?: string) => actual.loadSystemPromptTemplates(dir ?? templateDir.current),
  };
});
vi.mock('node:fs', async (importOriginal) => ({
  ...(await importOriginal<typeof import('node:fs')>()),
  appendFileSync: vi.fn(),
}));

function createPromptSession(cwd: string, identity?: string) {
  type Handler = (...args: readonly unknown[]) => unknown;
  const handlers = new Map<string, Handler>();
  const notify = vi.fn();
  const ctx = {
    cwd,
    sessionManager: {
      getEntries: () => [
        { type: 'custom', customType: 'sandpiper:session-start-date', data: { version: 1, date: '2026-11-11' } },
      ],
    },
    ui: { notify },
  };
  const pi = {
    on: (event: string, handler: Handler) => handlers.set(event, handler),
    registerFlag: vi.fn(),
    getFlag: () => identity,
    events: { on: () => () => {} },
    getAllTools: () => [],
  } as unknown as Parameters<typeof registerStartupPromptHooks>[0];
  registerStartupPromptHooks(pi);
  return {
    notify,
    start: (reason: string) => handlers.get('session_start')?.({ reason }, ctx),
    build: async (options: Partial<BuildSystemPromptOptions> = {}) => {
      const systemPromptOptions: BuildSystemPromptOptions = { cwd, ...options };
      await handlers.get('before_agent_start')?.({ systemPromptOptions }, ctx);
      return systemPromptOptions.customPrompt;
    },
  };
}

describe('session-scoped startup prompt inputs', () => {
  let root: string;

  beforeEach(() => {
    root = mkdtempSync(join(tmpdir(), 'sandpiper-prompt-cache-'));
    mockGetAgentDir.mockReturnValue(root);
    vi.mocked(execFileSync).mockReset();
    vi.mocked(appendFileSync).mockClear();
  });

  afterEach(() => {
    vi.restoreAllMocks();
    templateDir.current = undefined;
    rmSync(root, { recursive: true, force: true });
  });

  it.each(['startup', 'reload', 'new', 'resume', 'fork'])(
    'keeps the first jj detection for two builds and refreshes it at session_start (%s)',
    async (reason) => {
      mkdirSync(join(root, '.jj'));
      vi.mocked(execFileSync).mockReturnValue('currently colocated with Git');
      const session = createPromptSession(root);
      await session.start('startup');
      const first = await session.build();
      expect(first).toContain('colocated_git="true"');

      vi.mocked(execFileSync).mockImplementation(() => {
        throw new Error('jj timed out');
      });
      expect(await session.build()).toBe(first);
      expect(execFileSync).toHaveBeenCalledTimes(1);
      expect(session.notify).not.toHaveBeenCalled();
      expect(appendFileSync).not.toHaveBeenCalled();

      await session.start(reason);
      const refreshed = await session.build();
      expect(refreshed).not.toContain('colocated_git=');
      expect(refreshed).toContain('system="jj"');
      expect(execFileSync).toHaveBeenCalledTimes(2);
    },
  );

  it.each(['startup', 'reload', 'new', 'resume', 'fork'])(
    'keeps USER.md unchanged for two builds and reads edits after session_start (%s)',
    async (reason) => {
      const profile = join(root, 'USER.md');
      writeFileSync(profile, 'Original user profile');
      const session = createPromptSession(root);
      await session.start('startup');
      const first = await session.build();
      expect(first).toContain('Original user profile');

      writeFileSync(profile, 'Edited user profile');
      expect(await session.build()).toBe(first);

      await session.start(reason);
      const refreshed = await session.build();
      expect(refreshed).toContain('Edited user profile');
      expect(refreshed).not.toContain('Original user profile');
    },
  );

  it.each(['startup', 'reload', 'new', 'resume', 'fork'])(
    'keeps the prompt templates unchanged for two builds and reads edits after session_start (%s)',
    async (reason) => {
      templateDir.current = join(root, 'templates');
      cpSync(shippedTemplateDir, templateDir.current, { recursive: true });
      const session = createPromptSession(root);
      await session.start('startup');
      const first = await session.build();
      expect(first).toContain('expert software engineer working as a coding agent');

      writeFileSync(join(templateDir.current, 'identity.md'), '<identity>Edited template</identity>\n');
      expect(await session.build()).toBe(first);

      await session.start(reason);
      const refreshed = await session.build();
      expect(refreshed).toContain('<identity>Edited template</identity>');
      expect(refreshed).not.toContain('expert software engineer working as a coding agent');
    },
  );

  it.each(['startup', 'reload', 'new', 'resume', 'fork'])(
    'keeps the identity file unchanged for two builds and reads edits after session_start (%s)',
    async (reason) => {
      const identity = join(root, 'identity.md');
      writeFileSync(identity, '<identity>Original identity</identity>');
      const session = createPromptSession(root, identity);
      await session.start('startup');
      const first = await session.build();
      expect(first).toContain('<identity>Original identity</identity>');

      writeFileSync(identity, '<identity>Edited identity</identity>');
      expect(await session.build()).toBe(first);

      await session.start(reason);
      const refreshed = await session.build();
      expect(refreshed).toContain('<identity>Edited identity</identity>');
      expect(refreshed).not.toContain('Original identity');
    },
  );

  it.each(['startup', 'reload', 'new', 'resume', 'fork'])(
    'resets the prompt-change baseline at session_start (%s)',
    async (reason) => {
      const session = createPromptSession(root);
      await session.start('startup');
      await session.build({ appendSystemPrompt: 'Previous session prompt' });

      await session.start(reason);
      const refreshed = await session.build({ appendSystemPrompt: 'Current session prompt' });
      expect(refreshed).toContain('Current session prompt');
      expect(session.notify).not.toHaveBeenCalled();
      expect(appendFileSync).not.toHaveBeenCalled();
    },
  );

  it('keeps a failed detection until the next session even if jj recovers', async () => {
    mkdirSync(join(root, '.jj'));
    vi.mocked(execFileSync).mockImplementation(() => {
      throw new Error('jj timed out');
    });
    const session = createPromptSession(root);
    await session.start('startup');
    const first = await session.build();
    expect(first).toContain('system="jj"');
    expect(first).not.toContain('colocated_git=');

    vi.mocked(execFileSync).mockReturnValue('currently colocated with Git');
    expect(await session.build()).toBe(first);
    expect(execFileSync).toHaveBeenCalledTimes(1);

    await session.start('reload');
    expect(await session.build()).toContain('colocated_git="true"');
  });

  it('keeps an absent USER.md frozen until the next session', async () => {
    const session = createPromptSession(root);
    await session.start('startup');
    const first = await session.build();
    expect(first).not.toContain('<user_profile>');

    writeFileSync(join(root, 'USER.md'), 'New user profile');
    expect(await session.build()).toBe(first);

    await session.start('reload');
    expect(await session.build()).toContain('New user profile');
  });

  it('keeps the literal identity fallback if the file appears mid-session', async () => {
    const identity = join(root, 'identity.md');
    const session = createPromptSession(root, identity);
    await session.start('startup');
    const first = await session.build();
    expect(first).toContain(identity);

    writeFileSync(identity, '<identity>New identity</identity>');
    expect(await session.build()).toBe(first);

    await session.start('reload');
    expect(await session.build()).toContain('<identity>New identity</identity>');
  });

  it('still rebuilds from Pi options and reports changes against the first prompt of the session', async () => {
    vi.spyOn(Date, 'now').mockReturnValue(123);
    const session = createPromptSession(root);
    await session.start('startup');
    const first = await session.build({ appendSystemPrompt: 'First Pi append' });
    const second = await session.build({ appendSystemPrompt: 'Changed Pi append' });
    expect(second).not.toBe(first);
    expect(second).toContain('Changed Pi append');
    expect(session.notify).toHaveBeenCalledWith(expect.stringContaining('CHANGED-SYSPROMPT.diff'), 'warning');
    expect(appendFileSync).toHaveBeenCalledWith(
      join(homedir(), '123-CHANGED-SYSPROMPT.diff'),
      expect.stringContaining('-<content>First Pi append</content>'),
      { encoding: 'utf8' },
    );

    await session.build({ appendSystemPrompt: 'Third Pi append' });
    expect(appendFileSync).toHaveBeenLastCalledWith(
      expect.any(String),
      expect.stringContaining('-<content>First Pi append</content>'),
      { encoding: 'utf8' },
    );
  });
});
