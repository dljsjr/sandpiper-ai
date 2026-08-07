import { SANDPIPER_SYSTEM_NOTIFICATION_CUSTOM_TYPE } from 'sandpiper-ai-core';
import { describe, expect, it, vi } from 'vitest';
import { registerBackgroundProcessTools } from './background-process-tools.js';
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
});
