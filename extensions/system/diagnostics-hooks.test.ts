import * as core from 'sandpiper-ai-core';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { registerDiagnosticsHooks } from './diagnostics-hooks.js';
import { createDiagnosticsStub } from './test-helpers.js';

const plainTheme = {
  fg: (_color: string, text: string) => text,
  bold: (text: string) => text,
};

describe('registerDiagnosticsHooks', () => {
  beforeEach(() => {
    vi.spyOn(core, 'buildSystemDiagnosticsStartupPlan').mockReturnValue({
      unhealthyDiagnostics: [
        {
          key: 'example:check',
          healthy: false,
          message: 'Example check failed',
          instructions: ['run the example fix'],
        },
      ],
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('registers the entry renderer for the diagnostics banner up front', () => {
    const { pi, entryRenderers } = createDiagnosticsStub();

    registerDiagnosticsHooks(pi as Parameters<typeof registerDiagnosticsHooks>[0]);

    expect([...entryRenderers.keys()]).toEqual(['sandpiper:diagnostics-banner']);
  });

  it('appends a diagnostics banner entry when unhealthy diagnostics are present', async () => {
    const { pi, handlers, appendedEntries } = createDiagnosticsStub();

    registerDiagnosticsHooks(pi as Parameters<typeof registerDiagnosticsHooks>[0]);

    const handler = handlers.get('session_start');
    if (!handler) {
      throw new Error('session_start handler not registered');
    }

    await handler({}, { cwd: '/repo' });

    expect(core.buildSystemDiagnosticsStartupPlan).toHaveBeenCalledWith({ cwd: '/repo' });
    expect(appendedEntries).toEqual([
      {
        customType: 'sandpiper:diagnostics-banner',
        data: {
          diagnostics: [
            {
              key: 'example:check',
              healthy: false,
              message: 'Example check failed',
              instructions: ['run the example fix'],
            },
          ],
        },
      },
    ]);
  });

  describe('diagnostics banner renderer', () => {
    it('renders diagnostics with instructions', () => {
      const { pi, entryRenderers } = createDiagnosticsStub();
      registerDiagnosticsHooks(pi as Parameters<typeof registerDiagnosticsHooks>[0]);

      const renderer = entryRenderers.get('sandpiper:diagnostics-banner');
      if (!renderer) {
        throw new Error('diagnostics-banner renderer not registered');
      }

      const component = renderer(
        {
          data: {
            diagnostics: [
              {
                key: 'example:check',
                healthy: false,
                message: 'Example check failed',
                instructions: ['run the example fix'],
              },
            ],
          },
        },
        { expanded: false },
        plainTheme,
      );

      const lines = (component as { render: (width: number) => string[] } | undefined)?.render(80);
      expect(lines?.join('\n')).toContain('Sandpiper Diagnostics');
      expect(lines?.join('\n')).toContain('Example check failed');
      expect(lines?.join('\n')).toContain('run the example fix');
    });

    it('renders nothing when data is missing or empty', () => {
      const { pi, entryRenderers } = createDiagnosticsStub();
      registerDiagnosticsHooks(pi as Parameters<typeof registerDiagnosticsHooks>[0]);

      const renderer = entryRenderers.get('sandpiper:diagnostics-banner');
      if (!renderer) {
        throw new Error('diagnostics-banner renderer not registered');
      }

      expect(renderer({ data: undefined }, { expanded: false }, plainTheme)).toBeUndefined();
      expect(renderer({ data: { diagnostics: [] } }, { expanded: false }, plainTheme)).toBeUndefined();
    });
  });
});
