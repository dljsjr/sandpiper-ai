import * as core from 'sandpiper-ai-core';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { registerDiagnosticsHooks } from './diagnostics-hooks.js';
import { createDiagnosticsStub } from './test-helpers.js';

describe('registerDiagnosticsHooks', () => {
  beforeEach(() => {
    vi.spyOn(core, 'buildSystemDiagnosticsStartupPlan').mockReturnValue({
      unhealthyDiagnostics: [
        {
          key: 'shell-relay:integration',
          healthy: false,
          message: 'Shell relay integration not sourced',
          instructions: ['source ~/.sandpiper/shell-integrations/relay.fish'],
        },
      ],
      shouldCheckForUpdates: false,
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('registers a session_start hook and renders diagnostics banner content', async () => {
    const { pi, handlers } = createDiagnosticsStub();
    const checkForUpdates = vi.fn(async () => []);

    registerDiagnosticsHooks(pi as Parameters<typeof registerDiagnosticsHooks>[0], checkForUpdates);

    const handler = handlers.get('session_start');
    if (!handler) {
      throw new Error('session_start handler not registered');
    }

    const setWidget = vi.fn();
    await handler(
      {},
      {
        cwd: '/repo',
        ui: { setWidget },
      },
    );

    expect(core.buildSystemDiagnosticsStartupPlan).toHaveBeenCalledWith({ cwd: '/repo', preflightSource: pi });
    expect(setWidget).toHaveBeenCalledTimes(2);
    expect(setWidget).toHaveBeenNthCalledWith(1, 'sandpiper-banners', expect.any(Function));
    expect(setWidget).toHaveBeenNthCalledWith(2, 'sandpiper-banners', undefined);

    const renderWidget = setWidget.mock.calls[0]?.[1] as ((tui: unknown, theme: unknown) => unknown) | undefined;
    if (!renderWidget) {
      throw new Error('Widget render function missing');
    }

    const addChild = vi.fn();
    const theme = {
      fg: (_tone: string, text: string) => text,
      bold: (text: string) => text,
    };

    renderWidget({ children: [null, { addChild }] }, theme);
    expect(addChild).toHaveBeenCalled();
    expect(checkForUpdates).not.toHaveBeenCalled();
  });
});
