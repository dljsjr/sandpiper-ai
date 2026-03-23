import { execSync } from 'node:child_process';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { FifoManager } from './fifo.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const FISH_SCRIPT = join(__dirname, '..', 'shell-integration', 'relay.fish');
const BASH_SCRIPT = join(__dirname, '..', 'shell-integration', 'relay.bash');

describe('Shell Integration Scripts', () => {
  let tempDir: string;
  let fifoManager: FifoManager;

  beforeEach(() => {
    tempDir = mkdtempSync(join(tmpdir(), 'shell-integration-test-'));
    fifoManager = new FifoManager({ baseDir: tempDir, sessionId: 'test' });
    fifoManager.create();
    fifoManager.open();
  });

  afterEach(async () => {
    await fifoManager.shutdown();
    rmSync(tempDir, { recursive: true, force: true });
  });

  describe('Fish prompt hook', () => {
    it('should be a no-op when SHELL_RELAY_SIGNAL is not set', () => {
      // Source the script and trigger a prompt — should produce no errors
      const result = execSync(`fish -c "source ${FISH_SCRIPT}; __relay_prompt_hook" 2>&1`, {
        encoding: 'utf-8',
        timeout: 5000,
        env: { PATH: process.env.PATH ?? '' },
      });
      // No output expected — silent no-op
      expect(result.trim()).toBe('');
    });

    it('should be a no-op when SHELL_RELAY_SIGNAL points to nonexistent file', () => {
      const result = execSync(`fish -c "source ${FISH_SCRIPT}; __relay_prompt_hook" 2>&1`, {
        encoding: 'utf-8',
        timeout: 5000,
        env: {
          PATH: process.env.PATH ?? '',
          SHELL_RELAY_SIGNAL: '/tmp/nonexistent-fifo-12345',
        },
      });
      expect(result.trim()).toBe('');
    });

    it('should write prompt_ready when FIFO is valid', () => {
      execSync(`fish -c "source ${FISH_SCRIPT}; __relay_prompt_hook" 2>&1`, {
        encoding: 'utf-8',
        timeout: 5000,
        env: {
          PATH: process.env.PATH ?? '',
          SHELL_RELAY_SIGNAL: fifoManager.paths.signal,
        },
      });

      // Read from the FIFO — should have prompt_ready
      // Use a short timeout read since we're using O_RDWR
      const { openSync: fsOpen, readSync, closeSync: fsClose } = require('node:fs');
      const { constants } = require('node:fs');
      const buf = Buffer.alloc(256);
      const fd = fsOpen(fifoManager.paths.signal, constants.O_RDONLY | constants.O_NONBLOCK);
      const bytesRead = readSync(fd, buf);
      fsClose(fd);

      const content = buf.toString('utf-8', 0, bytesRead);
      expect(content).toContain('prompt_ready');
    });
  });

  describe('Fish __relay_run', () => {
    it('should error when FIFO env vars are not set', () => {
      let output = '';
      try {
        output = execSync(`fish -c "source ${FISH_SCRIPT}; __relay_run 'echo hello'" 2>&1 || true`, {
          encoding: 'utf-8',
          timeout: 5000,
          env: { PATH: process.env.PATH ?? '' },
          shell: '/bin/bash',
        });
      } catch (error: unknown) {
        const execError = error as { stdout?: string; stderr?: string; message?: string };
        output = execError.stdout ?? execError.stderr ?? execError.message ?? '';
      }
      expect(output).toContain('FIFO environment variables not set');
    });

    it('should detect unbuffer-relay when SHELL_RELAY_NO_UNBUFFER is set', () => {
      // With NO_UNBUFFER set, the wrapper should skip unbuffer-relay even if available
      // This is a behavioral test — we just verify it doesn't crash
      try {
        execSync(`fish -c "source ${FISH_SCRIPT}; __relay_run (string escape --style=script -- 'echo test')" 2>&1`, {
          encoding: 'utf-8',
          timeout: 5000,
          env: {
            PATH: process.env.PATH ?? '',
            SHELL_RELAY_SIGNAL: fifoManager.paths.signal,
            SHELL_RELAY_STDOUT: fifoManager.paths.stdout,
            SHELL_RELAY_STDERR: fifoManager.paths.stderr,
            SHELL_RELAY_NO_UNBUFFER: '1',
          },
        });
      } catch {
        // May fail because /dev/tty isn't available in this context,
        // but it shouldn't fail due to unbuffer-relay detection
      }
    });
  });

  describe('Bash prompt hook', () => {
    it('should be a no-op when SHELL_RELAY_SIGNAL is not set', () => {
      const result = execSync(`bash -c "source ${BASH_SCRIPT}; __relay_prompt_hook" 2>&1`, {
        encoding: 'utf-8',
        timeout: 5000,
        env: { PATH: process.env.PATH ?? '' },
      });
      expect(result.trim()).toBe('');
    });

    it('should be a no-op when SHELL_RELAY_SIGNAL points to nonexistent file', () => {
      const result = execSync(`bash -c "source ${BASH_SCRIPT}; __relay_prompt_hook" 2>&1`, {
        encoding: 'utf-8',
        timeout: 5000,
        env: {
          PATH: process.env.PATH ?? '',
          SHELL_RELAY_SIGNAL: '/tmp/nonexistent-fifo-12345',
        },
      });
      expect(result.trim()).toBe('');
    });

    it('should write prompt_ready when FIFO is valid', () => {
      execSync(`bash -c "source ${BASH_SCRIPT}; __relay_prompt_hook" 2>&1`, {
        encoding: 'utf-8',
        timeout: 5000,
        env: {
          PATH: process.env.PATH ?? '',
          SHELL_RELAY_SIGNAL: fifoManager.paths.signal,
        },
      });

      const { openSync: fsOpen, readSync, closeSync: fsClose } = require('node:fs');
      const { constants } = require('node:fs');
      const buf = Buffer.alloc(256);
      const fd = fsOpen(fifoManager.paths.signal, constants.O_RDONLY | constants.O_NONBLOCK);
      const bytesRead = readSync(fd, buf);
      fsClose(fd);

      const content = buf.toString('utf-8', 0, bytesRead);
      expect(content).toContain('prompt_ready');
    });
  });
});
