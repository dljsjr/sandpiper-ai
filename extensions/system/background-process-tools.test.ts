import { mkdtempSync, readdirSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { ProcessManager } from '../../packages/core/src/process-manager.js';
import { SANDPIPER_SYSTEM_NOTIFICATION_CUSTOM_TYPE } from '../../packages/core/src/system-notification.js';
import { createBackgroundProcessOutputBuffer, registerBackgroundProcessTools } from './background-process-tools.js';
import { createProcessManagerStub, createToolRegistrationStub } from './test-helpers.js';

describe('registerBackgroundProcessTools', () => {
  it('registers tools and starts a background process successfully', async () => {
    const { pi, tools } = createToolRegistrationStub();
    const spawn = vi.fn(() => ({
      info: { id: 'dev-server', pid: 4242, running: true, exitCode: null, exitSignal: null },
    }));
    const processManager = createProcessManagerStub({ spawn, get: vi.fn() });

    registerBackgroundProcessTools(
      pi as Parameters<typeof registerBackgroundProcessTools>[0],
      processManager as Parameters<typeof registerBackgroundProcessTools>[1],
    );

    expect(tools.map((tool) => tool.name)).toEqual(['start_background_process', 'check_background_process']);

    const startTool = tools[0];
    if (!startTool) {
      throw new Error('start_background_process not registered');
    }

    const result = await startTool.execute(
      'tool-call-id',
      { id: 'dev-server', command: 'bun', args: ['run', 'dev'] },
      undefined,
      undefined,
      { cwd: '/repo' },
    );

    expect(spawn).toHaveBeenCalledWith({
      id: 'dev-server',
      command: 'bun',
      args: ['run', 'dev'],
      cwd: '/repo',
    });
    expect(result.isError).toBeUndefined();
    expect(result.details).toMatchObject({ id: 'dev-server', pid: 4242, status: 'running' });
  });

  it('sends a steering notification that wakes the agent when a started process exits', async () => {
    const { pi, tools, sendMessage } = createToolRegistrationStub();
    let exitHandler: ((code: number | null, signal: string | null) => void) | undefined;
    const managedProcess = {
      info: { id: 'dev-server', pid: 4242, running: true, exitCode: null, exitSignal: null },
      onExit: vi.fn((handler: (code: number | null, signal: string | null) => void) => {
        exitHandler = handler;
      }),
    };
    const processManager = createProcessManagerStub({
      spawn: vi.fn(() => managedProcess),
      get: vi.fn(() => managedProcess),
    });

    registerBackgroundProcessTools(
      pi as Parameters<typeof registerBackgroundProcessTools>[0],
      processManager as Parameters<typeof registerBackgroundProcessTools>[1],
    );

    const startTool = tools.find((tool) => tool.name === 'start_background_process');
    if (!startTool) {
      throw new Error('start_background_process not registered');
    }

    await startTool.execute(
      'tool-call-id',
      { id: 'dev-server', command: 'bun', args: ['run', 'dev'] },
      undefined,
      undefined,
      { cwd: '/repo' },
    );
    exitHandler?.(0, null);

    expect(managedProcess.onExit).toHaveBeenCalledOnce();
    expect(sendMessage).toHaveBeenCalledWith(
      expect.objectContaining({
        customType: SANDPIPER_SYSTEM_NOTIFICATION_CUSTOM_TYPE,
        display: false,
        details: {
          sourceType: 'tool',
          sourceId: 'background_process',
          instructions:
            'A background process started with start_background_process completed. Use check_background_process if you need its final output before continuing.',
          data: {
            process: { id: 'dev-server', exitCode: 0, exitSignal: null },
          },
        },
      }),
      { deliverAs: 'steer', triggerTurn: true },
    );
  });

  it('returns errors for spawn failures and missing process lookups', async () => {
    const { pi, tools } = createToolRegistrationStub();
    const processManager = createProcessManagerStub({
      spawn: vi.fn(() => {
        throw new Error('duplicate id');
      }),
      get: vi.fn(() => undefined),
    });

    registerBackgroundProcessTools(
      pi as Parameters<typeof registerBackgroundProcessTools>[0],
      processManager as Parameters<typeof registerBackgroundProcessTools>[1],
    );

    const startTool = tools.find((tool) => tool.name === 'start_background_process');
    const checkTool = tools.find((tool) => tool.name === 'check_background_process');
    if (!startTool || !checkTool) {
      throw new Error('Expected background process tools to be registered');
    }

    const startResult = await startTool.execute(
      'tool-call-id',
      { id: 'dev-server', command: 'bun' },
      undefined,
      undefined,
      { cwd: '/repo' },
    );
    expect(startResult.isError).toBe(true);
    expect(startResult.content[0]?.text).toContain('Failed to start background process: duplicate id');

    const checkResult = await checkTool.execute('tool-call-id', { id: 'missing' }, undefined, undefined, {});
    expect(checkResult.isError).toBe(true);
    expect(checkResult.content[0]?.text).toContain('No background process found with ID "missing"');
  });

  describe('output beyond the display limit', () => {
    const managers: ProcessManager[] = [];
    let outputDir: string | undefined;

    afterEach(() => {
      for (const manager of managers.splice(0)) manager.killAll();
      vi.unstubAllEnvs();
      if (outputDir) rmSync(outputDir, { recursive: true, force: true });
    });

    it('shows the tail and saves the whole stream to a file, as the bash tool does', async () => {
      outputDir = mkdtempSync(join(tmpdir(), 'sp-bg-output-'));
      vi.stubEnv('TMPDIR', outputDir);
      const { pi, tools, sendMessage } = createToolRegistrationStub();
      const processManager = new ProcessManager({ createOutputBuffer: createBackgroundProcessOutputBuffer });
      managers.push(processManager);
      registerBackgroundProcessTools(pi as Parameters<typeof registerBackgroundProcessTools>[0], processManager);
      const startTool = tools.find((tool) => tool.name === 'start_background_process');
      const checkTool = tools.find((tool) => tool.name === 'check_background_process');
      if (!startTool || !checkTool) throw new Error('Expected background process tools to be registered');

      await startTool.execute(
        'tool-call-id',
        {
          id: 'noisy job',
          command: 'sh',
          args: ['-c', 'i=1; while [ $i -le 3000 ]; do echo line-$i; i=$((i+1)); done'],
        },
        undefined,
        undefined,
        { cwd: outputDir },
      );
      await vi.waitFor(() => expect(sendMessage).toHaveBeenCalledOnce(), { timeout: 3000 });
      const result = await checkTool.execute(
        'tool-call-id',
        { id: 'noisy job', include_stdout: true },
        undefined,
        undefined,
        {},
      );

      const text = result.content[0]?.text ?? '';
      const [fullOutputFile] = readdirSync(outputDir).filter((name) =>
        name.startsWith('sandpiper-bg-noisy_job-stdout-'),
      );
      if (!fullOutputFile) throw new Error('Expected a full output file');
      const fullOutputPath = join(outputDir, fullOutputFile);
      expect(text).toContain('STDOUT (3000 lines,');
      expect(text).toContain('line-3000');
      expect(text).not.toContain('line-1000\n');
      expect(text).toContain(`[Showing lines 1001-3000 of 3000. Full output: ${fullOutputPath}]`);
      const fullOutput = readFileSync(fullOutputPath, 'utf-8');
      expect(fullOutput.startsWith('line-1\n')).toBe(true);
      expect(fullOutput.endsWith('line-3000\n')).toBe(true);
    });
  });
});
