import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ZellijClient } from './zellij.js';

// Mock child_process
vi.mock('node:child_process', () => ({
  execSync: vi.fn(),
}));

import { execSync } from 'node:child_process';

const mockExecSync = vi.mocked(execSync);

describe('ZellijClient', () => {
  let client: ZellijClient;

  beforeEach(() => {
    vi.clearAllMocks();
    client = new ZellijClient({ sessionName: 'test-session', paneId: 'terminal_0' });
  });

  // ── Session Management ──────────────────────────────────────

  describe('createBackgroundSession', () => {
    it('should invoke zellij attach --create-background with session name', () => {
      mockExecSync.mockReturnValue('' as never);

      client.createBackgroundSession();

      const cmd = mockExecSync.mock.calls[0]![0] as string;
      expect(cmd).toContain('zellij attach --create-background');
      expect(cmd).toContain('test-session');
    });
  });

  describe('isAvailable', () => {
    it('should return true when zellij is installed', () => {
      mockExecSync.mockReturnValue('/usr/bin/zellij\n' as never);
      expect(client.isAvailable()).toBe(true);
    });

    it('should return false when zellij is not installed', () => {
      mockExecSync.mockImplementation(() => {
        throw new Error('command not found');
      });
      expect(client.isAvailable()).toBe(false);
    });
  });

  describe('listSessions', () => {
    it('should parse session names', () => {
      mockExecSync.mockReturnValue('my-session\nother-session\n' as never);

      const sessions = client.listSessions();
      expect(sessions).toEqual(['my-session', 'other-session']);
    });

    it('should return empty array when no sessions exist', () => {
      mockExecSync.mockReturnValue('' as never);
      expect(client.listSessions()).toEqual([]);
    });

    it('should use --short --no-formatting flags', () => {
      mockExecSync.mockReturnValue('' as never);
      client.listSessions();

      const cmd = mockExecSync.mock.calls[0]![0] as string;
      expect(cmd).toContain('--short');
      expect(cmd).toContain('--no-formatting');
    });
  });

  // ── Pane Discovery ──────────────────────────────────────────

  describe('listPanes', () => {
    it('should parse pane info from JSON output', () => {
      mockExecSync.mockReturnValue(
        JSON.stringify([
          {
            id: 0,
            is_plugin: false,
            is_focused: true,
            is_floating: false,
            title: '/bin/fish',
            exited: false,
            exit_status: null,
            pane_command: 'fish',
            pane_cwd: '/home/user',
            tab_id: 0,
            tab_name: 'Tab #1',
            pane_rows: 24,
            pane_columns: 80,
          },
        ]) as never,
      );

      const panes = client.listPanes();
      expect(panes).toHaveLength(1);
      expect(panes[0]?.id).toBe(0);
      expect(panes[0]?.paneCommand).toBe('fish');
      expect(panes[0]?.isPlugin).toBe(false);
    });

    it('should use --session flag', () => {
      mockExecSync.mockReturnValue('[]' as never);
      client.listPanes();

      const cmd = mockExecSync.mock.calls[0]![0] as string;
      expect(cmd).toContain('--session');
      expect(cmd).toContain('test-session');
    });

    it('should return empty array on error', () => {
      mockExecSync.mockImplementation(() => {
        throw new Error('no session');
      });
      expect(client.listPanes()).toEqual([]);
    });
  });

  describe('findTerminalPane', () => {
    it('should return the first non-plugin pane ID', () => {
      mockExecSync.mockReturnValue(
        JSON.stringify([
          { id: 0, is_plugin: true, exited: false },
          { id: 1, is_plugin: false, exited: false, title: 'fish' },
        ]) as never,
      );

      expect(client.findTerminalPane()).toBe('terminal_1');
    });

    it('should skip exited panes', () => {
      mockExecSync.mockReturnValue(
        JSON.stringify([
          { id: 0, is_plugin: false, exited: true, title: 'dead' },
          { id: 1, is_plugin: false, exited: false, title: 'alive' },
        ]) as never,
      );

      expect(client.findTerminalPane()).toBe('terminal_1');
    });

    it('should return undefined when no terminal panes exist', () => {
      mockExecSync.mockReturnValue(JSON.stringify([{ id: 0, is_plugin: true, exited: false }]) as never);

      expect(client.findTerminalPane()).toBeUndefined();
    });
  });

  // ── Command Injection ───────────────────────────────────────

  describe('paste', () => {
    it('should use zellij action paste with --session and --pane-id', () => {
      mockExecSync.mockReturnValue('' as never);

      client.paste('echo hello');

      const cmd = mockExecSync.mock.calls[0]![0] as string;
      expect(cmd).toContain('--session');
      expect(cmd).toContain('test-session');
      expect(cmd).toContain('action paste');
      expect(cmd).toContain('--pane-id terminal_0');
      expect(cmd).toContain('echo hello');
    });
  });

  describe('sendKeys', () => {
    it('should use zellij action send-keys with key names', () => {
      mockExecSync.mockReturnValue('' as never);

      client.sendKeys('Enter');

      const cmd = mockExecSync.mock.calls[0]![0] as string;
      expect(cmd).toContain('action send-keys');
      expect(cmd).toContain('Enter');
      expect(cmd).toContain('--pane-id terminal_0');
    });

    it('should support multiple keys', () => {
      mockExecSync.mockReturnValue('' as never);

      client.sendKeys('Ctrl c', 'Enter');

      const cmd = mockExecSync.mock.calls[0]![0] as string;
      expect(cmd).toContain('Ctrl c');
      expect(cmd).toContain('Enter');
    });
  });

  describe('injectCommand', () => {
    it('should paste the command then send Enter', () => {
      mockExecSync.mockReturnValue('' as never);

      client.injectCommand('echo hello');

      expect(mockExecSync).toHaveBeenCalledTimes(2);
      const pasteCmd = mockExecSync.mock.calls[0]![0] as string;
      const enterCmd = mockExecSync.mock.calls[1]![0] as string;
      expect(pasteCmd).toContain('action paste');
      expect(pasteCmd).toContain('echo hello');
      expect(enterCmd).toContain('action send-keys');
      expect(enterCmd).toContain('Enter');
    });
  });

  // ── Output Capture ──────────────────────────────────────────

  describe('dumpScreen', () => {
    it('should return stdout as string', () => {
      mockExecSync.mockReturnValue('line 1\nline 2\n' as never);

      const result = client.dumpScreen();
      expect(result).toContain('line 1');
      expect(result).toContain('line 2');
    });

    it('should use --full flag and --pane-id', () => {
      mockExecSync.mockReturnValue('' as never);

      client.dumpScreen();

      const cmd = mockExecSync.mock.calls[0]![0] as string;
      expect(cmd).toContain('dump-screen --full');
      expect(cmd).toContain('--pane-id terminal_0');
    });

    it('should include --ansi flag when requested', () => {
      mockExecSync.mockReturnValue('' as never);

      client.dumpScreen({ ansi: true });

      const cmd = mockExecSync.mock.calls[0]![0] as string;
      expect(cmd).toContain('--ansi');
    });
  });

  // ── Pane ID requirement ─────────────────────────────────────

  describe('pane targeting', () => {
    it('should throw when pane-targeted operation is called without pane ID', () => {
      const noPaneClient = new ZellijClient({ sessionName: 'test-session' });

      expect(() => noPaneClient.paste('hello')).toThrow('No pane ID set');
      expect(() => noPaneClient.sendKeys('Enter')).toThrow('No pane ID set');
      expect(() => noPaneClient.dumpScreen()).toThrow('No pane ID set');
    });

    it('should work after setPaneId is called', () => {
      mockExecSync.mockReturnValue('' as never);

      const noPaneClient = new ZellijClient({ sessionName: 'test-session' });
      noPaneClient.setPaneId('terminal_1');
      noPaneClient.paste('hello');

      const cmd = mockExecSync.mock.calls[0]![0] as string;
      expect(cmd).toContain('--pane-id terminal_1');
    });
  });

  // ── Legacy ──────────────────────────────────────────────────

  describe('writeChars (deprecated)', () => {
    it('should still work for backward compatibility', () => {
      mockExecSync.mockReturnValue('' as never);

      client.writeChars('echo hello\n');

      const cmd = mockExecSync.mock.calls[0]![0] as string;
      expect(cmd).toContain('write-chars');
      expect(cmd).toContain('echo hello');
    });
  });
});
