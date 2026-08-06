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

  it('registers entry renderers for the diagnostics and update banners up front', () => {
    const { pi, entryRenderers } = createDiagnosticsStub();
    const checkForUpdates = vi.fn(async () => []);

    registerDiagnosticsHooks(pi as Parameters<typeof registerDiagnosticsHooks>[0], checkForUpdates);

    expect(entryRenderers.has('sandpiper:diagnostics-banner')).toBe(true);
    expect(entryRenderers.has('sandpiper:update-banner')).toBe(true);
  });

  it('appends a diagnostics banner entry when unhealthy diagnostics are present', async () => {
    const { pi, handlers, appendedEntries } = createDiagnosticsStub();
    const checkForUpdates = vi.fn(async () => []);

    registerDiagnosticsHooks(pi as Parameters<typeof registerDiagnosticsHooks>[0], checkForUpdates);

    const handler = handlers.get('session_start');
    if (!handler) {
      throw new Error('session_start handler not registered');
    }

    await handler({}, { cwd: '/repo' });

    expect(core.buildSystemDiagnosticsStartupPlan).toHaveBeenCalledWith({ cwd: '/repo', preflightSource: pi });
    expect(appendedEntries).toEqual([
      {
        customType: 'sandpiper:diagnostics-banner',
        data: {
          diagnostics: [
            {
              key: 'shell-relay:integration',
              healthy: false,
              message: 'Shell relay integration not sourced',
              instructions: ['source ~/.sandpiper/shell-integrations/relay.fish'],
            },
          ],
        },
      },
    ]);
    expect(checkForUpdates).not.toHaveBeenCalled();
  });

  it('appends an update banner entry per update when updates are available', async () => {
    vi.spyOn(core, 'buildSystemDiagnosticsStartupPlan').mockReturnValue({
      unhealthyDiagnostics: [],
      shouldCheckForUpdates: true,
    });
    const { pi, handlers, appendedEntries } = createDiagnosticsStub();
    const checkForUpdates = vi.fn(async () => [
      {
        name: 'sandpiper',
        currentVersion: '1.0.0',
        latestVersion: '1.1.0',
        installCommand: 'bun add -g sandpiper-ai',
      },
    ]);

    registerDiagnosticsHooks(pi as Parameters<typeof registerDiagnosticsHooks>[0], checkForUpdates);

    const handler = handlers.get('session_start');
    if (!handler) {
      throw new Error('session_start handler not registered');
    }

    await handler({}, { cwd: '/repo' });
    await checkForUpdates.mock.results[0]?.value;
    await Promise.resolve();

    expect(appendedEntries).toEqual([
      {
        customType: 'sandpiper:update-banner',
        data: {
          name: 'sandpiper',
          currentVersion: '1.0.0',
          latestVersion: '1.1.0',
          installCommand: 'bun add -g sandpiper-ai',
        },
      },
    ]);
  });

  describe('diagnostics banner renderer', () => {
    it('renders diagnostics with instructions', () => {
      const { pi, entryRenderers } = createDiagnosticsStub();
      registerDiagnosticsHooks(
        pi as Parameters<typeof registerDiagnosticsHooks>[0],
        vi.fn(async () => []),
      );

      const renderer = entryRenderers.get('sandpiper:diagnostics-banner');
      if (!renderer) {
        throw new Error('diagnostics-banner renderer not registered');
      }

      const component = renderer(
        {
          data: {
            diagnostics: [
              {
                key: 'shell-relay:integration',
                healthy: false,
                message: 'Shell relay integration not sourced',
                instructions: ['source ~/.sandpiper/shell-integrations/relay.fish'],
              },
            ],
          },
        },
        { expanded: false },
        plainTheme,
      );

      const lines = (component as { render: (width: number) => string[] } | undefined)?.render(80);
      expect(lines?.join('\n')).toContain('Sandpiper Diagnostics');
      expect(lines?.join('\n')).toContain('Shell relay integration not sourced');
      expect(lines?.join('\n')).toContain('source ~/.sandpiper/shell-integrations/relay.fish');
    });

    it('renders nothing when data is missing or empty', () => {
      const { pi, entryRenderers } = createDiagnosticsStub();
      registerDiagnosticsHooks(
        pi as Parameters<typeof registerDiagnosticsHooks>[0],
        vi.fn(async () => []),
      );

      const renderer = entryRenderers.get('sandpiper:diagnostics-banner');
      if (!renderer) {
        throw new Error('diagnostics-banner renderer not registered');
      }

      expect(renderer({ data: undefined }, { expanded: false }, plainTheme)).toBeUndefined();
      expect(renderer({ data: { diagnostics: [] } }, { expanded: false }, plainTheme)).toBeUndefined();
    });
  });

  describe('update banner renderer', () => {
    it('renders update details including the changelog link when present', () => {
      const { pi, entryRenderers } = createDiagnosticsStub();
      registerDiagnosticsHooks(
        pi as Parameters<typeof registerDiagnosticsHooks>[0],
        vi.fn(async () => []),
      );

      const renderer = entryRenderers.get('sandpiper:update-banner');
      if (!renderer) {
        throw new Error('update-banner renderer not registered');
      }

      const component = renderer(
        {
          data: {
            name: 'sandpiper',
            currentVersion: '1.0.0',
            latestVersion: '1.1.0',
            installCommand: 'bun add -g sandpiper-ai',
            changelogUrl: 'https://example.com/changelog',
          },
        },
        { expanded: false },
        plainTheme,
      );

      const lines = (component as { render: (width: number) => string[] } | undefined)?.render(80);
      const text = lines?.join('\n');
      expect(text).toContain('Update Available');
      expect(text).toContain('sandpiper: 1.0.0 → 1.1.0');
      expect(text).toContain('bun add -g sandpiper-ai');
      expect(text).toContain('https://example.com/changelog');
    });

    it('renders nothing when data is missing', () => {
      const { pi, entryRenderers } = createDiagnosticsStub();
      registerDiagnosticsHooks(
        pi as Parameters<typeof registerDiagnosticsHooks>[0],
        vi.fn(async () => []),
      );

      const renderer = entryRenderers.get('sandpiper:update-banner');
      if (!renderer) {
        throw new Error('update-banner renderer not registered');
      }

      expect(renderer({ data: undefined }, { expanded: false }, plainTheme)).toBeUndefined();
    });
  });
});
