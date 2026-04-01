import { describe, expect, it, vi } from 'vitest';
import { registerBackgroundProcessTools } from './background-process-tools.js';
import { createProcessManagerStub, createToolRegistrationStub } from './test-helpers.js';

describe('registerBackgroundProcessTools', () => {
  it('registers tools and starts a background process successfully', async () => {
    const { pi, tools } = createToolRegistrationStub();
    const spawn = vi.fn(() => ({ pid: 4242 }));
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
