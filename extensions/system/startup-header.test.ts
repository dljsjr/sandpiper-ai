import { type ExtensionAPI, initTheme, type Theme } from '@earendil-works/pi-coding-agent';
import { beforeAll, describe, expect, it, vi } from 'vitest';
import { registerStartupHeader, SandpiperHeader } from './startup-header.js';

const plainTheme = {
  fg: (_color: string, text: string) => text,
  bold: (text: string) => text,
} as unknown as Theme;

function render(header: SandpiperHeader): string {
  return header.render(200).join('\n');
}

describe('Sandpiper startup header', () => {
  beforeAll(() => {
    // Pi's key hint helpers style text with Pi's global theme.
    initTheme(undefined, false);
  });

  it("shows Sandpiper's name and version instead of Pi's logo", () => {
    const header = new SandpiperHeader(plainTheme, '1.2.3');

    expect(render(header)).toContain('sandpiper v1.2.3');
    expect(render(header)).not.toContain('Pi can explain its own features');
  });

  it('shows compact key hints, and the full list when startup help is expanded', () => {
    const header = new SandpiperHeader(plainTheme, '1.2.3');
    expect(render(header)).toContain('commands');
    expect(render(header)).not.toContain('to cycle models');

    header.setExpanded(true);

    expect(render(header)).toContain('to cycle models');
  });

  it('replaces the header only in the interactive TUI', async () => {
    const handlers = new Map<string, (event: unknown, ctx: unknown) => unknown>();
    const pi = {
      on: (event: string, handler: (event: unknown, ctx: unknown) => unknown) => {
        handlers.set(event, handler);
        return () => {};
      },
    } as unknown as ExtensionAPI;
    registerStartupHeader(pi);
    const tuiSetHeader = vi.fn();
    const printSetHeader = vi.fn();

    await handlers.get('session_start')?.({}, { mode: 'tui', ui: { setHeader: tuiSetHeader } });
    await handlers.get('session_start')?.({}, { mode: 'print', ui: { setHeader: printSetHeader } });

    expect(tuiSetHeader).toHaveBeenCalledOnce();
    expect(printSetHeader).not.toHaveBeenCalled();
  });
});
